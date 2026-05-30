using Opc.Ua;
using Opc.Ua.Client;
using Opc.Ua.Configuration;
using System.Text;

namespace MES_ME.Server.OpcUa;

/// <summary>
/// Держит OPC UA сессии с Subscription для каждого контроллера.
/// При разрыве — переподключается с экспоненциальной задержкой.
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
                attempt = 0;
            }
            catch (OperationCanceledException) when (ct.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                attempt++;
                var delay = TimeSpan.FromSeconds(Math.Min(Math.Pow(2, attempt), 60));
                _log.LogError(ex,
                    "OPC UA connection lost for {Controller} (attempt {Attempt}). Reconnecting in {Delay}s",
                    controller.Name, attempt, delay.TotalSeconds);

                _svc.SetSession(controller.Name, null);
                await Task.Delay(delay, ct);
            }
        }
    }

    private async Task ConnectAndRunAsync(OpcUaControllerConfig controller, CancellationToken ct)
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
                TrustedPeerCertificates = new CertificateTrustList
                {
                    StoreType = "Directory",
                    StorePath = Path.Combine(certificatePath, "TrustedPeer")
                },
                TrustedIssuerCertificates = new CertificateTrustList
                {
                    StoreType = "Directory",
                    StorePath = Path.Combine(certificatePath, "TrustedIssuer")
                },
                RejectedCertificateStore = new CertificateTrustList
                {
                    StoreType = "Directory",
                    StorePath = Path.Combine(certificatePath, "Rejected")
                },
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

        // Создаём директории для сертификатов
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
        EndpointDescription endpointDesc;
        try
        {
            endpointDesc = CoreClientUtils.SelectEndpoint(
                config, controller.EndpointUrl, useSecurity: !controller.AnonymousAuth);
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "Failed to select endpoint for {Url} ({Controller})",
                controller.EndpointUrl, controller.Name);
            throw;
        }

        var endpoint = new ConfiguredEndpoint(null, endpointDesc,
            EndpointConfiguration.Create(config));

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
        var session = await Session.Create(
            config, endpoint, false, $"MES_ME_{controller.Name}", 60000, identity, null);

        _log.LogInformation("OPC UA session opened: {Url} ({Controller})",
            controller.EndpointUrl, controller.Name);
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

        // Создаём MonitoredItem для каждого тега
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

            var capturedNodeId = node.NodeId;
            var capturedControllerName = controller.Name;

            item.Notification += (_, e) =>
            {
                if (e.NotificationValue is MonitoredItemNotification n)
                    _svc.OnDataChange(capturedControllerName, capturedNodeId, n.Value);
            };

            itemsToCreate.Add(item);
        }

        subscription.AddItems(itemsToCreate);
        session.AddSubscription(subscription);
        subscription.Create();

        _log.LogInformation(
            "OPC UA subscription created for {Controller}: {Count} items, interval={Interval}ms",
            controller.Name, controller.Nodes.Count, _opts.PublishInterval);

        // 6 — Ждём пока не отменят или сессия не упадёт
        while (!ct.IsCancellationRequested && session.Connected)
        {
            await Task.Delay(2000, ct);
        }

        _log.LogWarning("OPC UA session disconnected ({Controller})", controller.Name);
        _svc.SetSession(controller.Name, null);

        // Важно: не используем using, т.к. сессия может понадобиться после переподключения
        // Просто закрываем если нужно
        if (session.Connected)
        {
            session.Close();
        }
    }

    public override void Dispose()
    {
        foreach (var controller in _opts.Controllers)
        {
            _svc.SetSession(controller.Name, null);
        }
        base.Dispose();
    }
}