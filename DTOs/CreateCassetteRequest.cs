namespace MES_ME.Server.DTOs
{
    public class CreateCassetteRequest
    {
        /// <summary>
        /// Опциональные заметки при создании кассеты.
        /// </summary>
        public string? Notes { get; set; }
        // В будущем можно добавить другие поля, например, originalPackNumber, если нужно указывать при создании.
    }
}
