using Opc.Ua;
using Opc.Ua.Client;
using Opc.Ua.Configuration;
using System.Text;

namespace MES_ME.Server.OpcUa;

/// <summary>
/// Держит OPC UA сессии с Subscription для каждого контроллера.
/// При разрыве — корректно уничтожает старую сессию и переподключается с экспоненциальной задержкой.
/// </summary>
public sealed class OpcUaBackgroundService : BackgroundService
{
    private readonly OpcUaOptions _opts;
    private readonly OpcUaService _svc;
    private readonly ILogger<OpcUaBackgroundService> _log;
    private readonly IWebHostEnvironment _environment;

    public OpcUaBackgroundService(
        OpcUaOptions opts,
        IOpcUaService svc,
        ILogger<OpcUaBackgroundService> log,
        IWebHostEnvironment environment)
    {
        _opts = opts;
        _svc = (OpcUaService)svc;
        _log = log;
        _environment = environment;
    }

    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        _log.LogInformation("OpcUaBackgroundService starting. Controllers: {Count}", _opts.Controllers.Count);

        // Запускаем задачу для каждого контроллера параллельно
        var tasks = _opts.Controllers.Select(c => RunControllerAsync(c, ct));
        await Task.WhenAll(tasks);

        _log.LogInformation("OpcUaBackgroundService stopped");
    }

    private async Task RunControllerAsync(OpcUaControllerConfig controller, CancellationToken ct)
    {
        var attempt = 0;

        while (!ct.IsCancellationRequested)
        {
            try
            {
                await ConnectAndRunAsync(controller, ct);
                attempt = 0; // Сброс счетчика при успешном долгом соединении
            }
            catch (OperationCanceledException) when (ct.IsCancellationRequested)
            {
                _log.LogInformation("OpcUaBackgroundService cancellation requested for {Controller}", controller.Name);
                break;
            }
            catch (Exception ex)
            {
                attempt++;
                var delay = TimeSpan.FromSeconds(Math.Min(Math.Pow(2, attempt), 60));
                _log.LogError(ex,
                    "OPC UA connection lost for {Controller} (attempt {Attempt}). Reconnecting in {Delay}s",
                    controller.Name, attempt, delay.TotalSeconds);

                // Гарантируем, что сервис знает о разрыве
                _svc.SetSession(controller.Name, null);

                await Task.Delay(delay, ct);
            }
        }
    }

    private async Task ConnectAndRunAsync(OpcUaControllerConfig controller, CancellationToken ct)
    {
        Session? session = null;

        try
        {
            // 1 — Создаём конфигурацию с корректными путями для сертификатов
            var certificatePath = Path.Combine(_environment.ContentRootPath, "Certificates", controller.Name);
            Directory.CreateDirectory(certificatePath);

            var config = new ApplicationConfiguration
            {
                ApplicationName = $"MES_ME_OpcClient_{controller.Name}",
                ApplicationType = ApplicationType.Client,
                ApplicationUri = $"urn:mes_me:opcua:client:{controller.Name}",
                SecurityConfiguration = new SecurityConfiguration
                {
                    ApplicationCertificate = new CertificateIdentifier
                    {
                        StoreType = "Directory",
                        StorePath = Path.Combine(certificatePath, "Application"),
                        SubjectName = $"CN=MES_ME_OpcClient_{controller.Name}, O=MES_ME, C=RU"
                    },
                    TrustedPeerCertificates = new CertificateTrustList { StoreType = "Directory", StorePath = Path.Combine(certificatePath, "TrustedPeer") },
                    TrustedIssuerCertificates = new CertificateTrustList { StoreType = "Directory", StorePath = Path.Combine(certificatePath, "TrustedIssuer") },
                    RejectedCertificateStore = new CertificateTrustList { StoreType = "Directory", StorePath = Path.Combine(certificatePath, "Rejected") },
                    AutoAcceptUntrustedCertificates = true,
                    AddAppCertToTrustedStore = false
                },
                TransportConfigurations = new TransportConfigurationCollection(),
                TransportQuotas = new TransportQuotas
                {
                    OperationTimeout = 10000,
                    MaxStringLength = 1048576,
                    MaxByteStringLength = 1048576,
                    MaxArrayLength = 65535,
                    MaxMessageSize = 4194304,
                    MaxBufferSize = 65535,
                    ChannelLifetime = 300000,
                    SecurityTokenLifetime = 3600000
                },
                ClientConfiguration = new ClientConfiguration
                {
                    DefaultSessionTimeout = 60000,
                    MinSubscriptionLifetime = 10000
                },
                TraceConfiguration = new TraceConfiguration(),
                DisableHiResClock = true
            };

            foreach (var storePath in new[]
            {
                config.SecurityConfiguration.ApplicationCertificate.StorePath,
                config.SecurityConfiguration.TrustedPeerCertificates.StorePath,
                config.SecurityConfiguration.TrustedIssuerCertificates.StorePath,
                config.SecurityConfiguration.RejectedCertificateStore.StorePath
            })
            {
                if (!string.IsNullOrEmpty(storePath))
                    Directory.CreateDirectory(storePath);
            }

            await config.Validate(ApplicationType.Client);

            // 2 — Выбираем endpoint
            var endpointDesc = CoreClientUtils.SelectEndpoint(
                config, controller.EndpointUrl, useSecurity: !controller.AnonymousAuth);

            var endpoint = new ConfiguredEndpoint(null, endpointDesc, EndpointConfiguration.Create(config));

            // 3 — Создаём идентификацию
            UserIdentity identity;
            if (controller.AnonymousAuth)
            {
                identity = new UserIdentity(new AnonymousIdentityToken());
            }
            else
            {
                var token = new UserNameIdentityToken
                {
                    UserName = controller.Username,
                    Password = Encoding.UTF8.GetBytes(controller.Password!),
                    EncryptionAlgorithm = null
                };
                identity = new UserIdentity(token);
            }

            // 4 — Создаём и открываем сессию
            session = await Session.Create(
                config, endpoint, false, $"MES_ME_{controller.Name}", 60000, identity, null);

            _log.LogInformation("OPC UA session opened: {Url} ({Controller})", controller.EndpointUrl, controller.Name);
            _svc.SetSession(controller.Name, session);

            // 5 — Подписка на теги
            var subscription = new Subscription(session.DefaultSubscription)
            {
                PublishingInterval = _opts.PublishInterval,
                PublishingEnabled = true,
                LifetimeCount = 60,
                KeepAliveCount = 10,
                Priority = 1
            };

            var itemsToCreate = new List<MonitoredItem>();

            foreach (var node in controller.Nodes)
            {
                var item = new MonitoredItem(subscription.DefaultItem)
                {
                    DisplayName = node.Alias,
                    StartNodeId = NodeId.Parse(node.NodeId),
                    AttributeId = Attributes.Value,
                    SamplingInterval = _opts.SamplingInterval,
                    QueueSize = 1,
                    DiscardOldest = true,
                    MonitoringMode = MonitoringMode.Reporting
                };

                var capturedAlias = node.Alias;
                var capturedControllerName = controller.Name;

                item.Notification += (_, e) =>
                {
                    if (e.NotificationValue is MonitoredItemNotification n)
                    {
                        _svc.OnDataChange(capturedControllerName, capturedAlias, n.Value);
                    }
                };
                itemsToCreate.Add(item);
            }

            subscription.AddItems(itemsToCreate);
            session.AddSubscription(subscription);
            subscription.Create();

            _log.LogInformation("OPC UA subscription created for {Controller}: {Count} items, interval={Interval}ms",
                controller.Name, controller.Nodes.Count, _opts.PublishInterval);

            // 6 — Ожидание разрыва соединения через событие KeepAlive
            var disconnectTcs = new TaskCompletionSource<bool>();

            session.KeepAlive += (s, e) =>
            {
                // Если статус плохой, значит связь потеряна
                if (e.Status != null && StatusCode.IsBad(e.Status.Code))
                {
                    _log.LogWarning("OPC UA KeepAlive bad status for {Controller}: {Status}", controller.Name, e.Status);
                    disconnectTcs.TrySetResult(true);
                }
            };

            // Ждем либо отмены токена, либо срабатывания KeepAlive (разрыв связи)
            var delayTask = Task.Delay(Timeout.Infinite, ct);
            var completedTask = await Task.WhenAny(delayTask, disconnectTcs.Task);

            if (completedTask == disconnectTcs.Task)
            {
                _log.LogWarning("OPC UA session disconnected via KeepAlive ({Controller})", controller.Name);
            }
        }
        finally
        {
            // 7 — ГАРАНТИРОВАННАЯ ОЧИСТКА РЕСУРСОВ
            // Сообщаем сервису, что сессии больше нет (UI/API сразу увидит отключение)
            _svc.SetSession(controller.Name, null);

            if (session != null)
            {
                try
                {
                    // Пытаемся корректно закрыть, но не блокируем поток, если сервер уже недоступен
                    session.Close();
                }
                catch (Exception ex)
                {
                    _log.LogDebug(ex, "Ignored error while closing OPC UA session for {Controller}", controller.Name);
                }
                finally
                {
                    // Обязательно освобождаем ресурсы, чтобы не было утечек сокетов!
                    session.Dispose();
                }
            }
        }
    }

    public override void Dispose()
    {
        // При остановке приложения очищаем ссылки
        foreach (var controller in _opts.Controllers)
        {
            _svc.SetSession(controller.Name, null);
        }
        base.Dispose();
    }
}