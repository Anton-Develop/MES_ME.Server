namespace MES_ME.Server.DTOs
{
    public class UpdateStatusRequest
    {
        public List<string> MatIds { get; set; }
        public string NewStatus { get; set; }
    }
}
