using Opc.Ua;
using Opc.Ua.Client;
using Opc.Ua.Configuration;
using System.Text;

namespace MES_ME.Server.OpcUa;

/// <summary>
/// Держит одну OPC UA сессию с Subscription.
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
        _log.LogInformation("OpcUaBackgroundService starting. Endpoint={Url}", _opts.EndpointUrl);

        var attempt = 0;

        while (!ct.IsCancellationRequested)
        {
            try
            {
                await ConnectAndRunAsync(ct);
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
                    "OPC UA connection lost (attempt {Attempt}). Reconnecting in {Delay}s",
                    attempt, delay.TotalSeconds);

                _svc.SetSession(null);
                await Task.Delay(delay, ct);
            }
        }

        _log.LogInformation("OpcUaBackgroundService stopped");
    }

    private async Task ConnectAndRunAsync(CancellationToken ct)
    {
        // 1 — Создаём конфигурацию с корректными путями для сертификатов
        var certificatePath = Path.Combine(_environment.ContentRootPath, "Certificates");
        Directory.CreateDirectory(certificatePath);

        var config = new ApplicationConfiguration
        {
            ApplicationName = "MES_ME_OpcClient",
            ApplicationType = ApplicationType.Client,
            ApplicationUri = "urn:mes_me:opcua:client",
            SecurityConfiguration = new SecurityConfiguration
            {
                ApplicationCertificate = new CertificateIdentifier
                {
                    StoreType = "Directory",
                    StorePath = Path.Combine(certificatePath, "Application"),
                    SubjectName = "CN=MES_ME_OpcClient, O=MES_ME, C=RU"
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
                config, _opts.EndpointUrl, useSecurity: !_opts.AnonymousAuth);
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "Failed to select endpoint for {Url}", _opts.EndpointUrl);
            throw;
        }
        
        var endpoint = new ConfiguredEndpoint(null, endpointDesc,
            EndpointConfiguration.Create(config));

        // 3 — Создаём идентификацию
        UserIdentity identity;
        if (_opts.AnonymousAuth)
        {
            identity = new UserIdentity(new AnonymousIdentityToken());
        }
        else
        {
            var token = new UserNameIdentityToken
            {
                UserName = _opts.Username,
                Password = Encoding.UTF8.GetBytes(_opts.Password!),
                EncryptionAlgorithm = null
            };
            identity = new UserIdentity(token);
        }

        // 4 — Создаём и открываем сессию
        var session = await Session.Create(
            config, endpoint, false, "MES_ME", 60000, identity, null);

        _log.LogInformation("OPC UA session opened: {Url}", _opts.EndpointUrl);
        _svc.SetSession(session);

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
        
        foreach (var node in _opts.Nodes)
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
            item.Notification += (_, e) =>
            {
                if (e.NotificationValue is MonitoredItemNotification n)
                    _svc.OnDataChange(capturedNodeId, n.Value);
            };

            itemsToCreate.Add(item);
        }

        subscription.AddItems(itemsToCreate);
        session.AddSubscription(subscription);
        subscription.Create();

        _log.LogInformation(
            "OPC UA subscription created: {Count} items, interval={Interval}ms",
            _opts.Nodes.Count, _opts.PublishInterval);

        // 6 — Ждём пока не отменят или сессия не упадёт
        while (!ct.IsCancellationRequested && session.Connected)
        {
            await Task.Delay(2000, ct);
        }

        _log.LogWarning("OPC UA session disconnected");
        _svc.SetSession(null);
        
        // Важно: не используем using, т.к. сессия может понадобиться после переподключения
        // Просто закрываем если нужно
        if (session.Connected)
        {
            session.Close();
        }
    }

    public override void Dispose()
    {
        _svc.SetSession(null);
        base.Dispose();
    }
}