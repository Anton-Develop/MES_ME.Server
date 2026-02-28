using System.ComponentModel.DataAnnotations;

namespace MES_ME.Server.DTOs
{
    public class UpdateCassetteStatusRequest
    {
        /// <summary>
        /// Новый статус кассеты. Обязательное поле.
        /// </summary>
        [Required(ErrorMessage = "Поле 'NewStatus' обязательно для заполнения.")]
        public string NewStatus { get; set; } = null!; // null-forgiving operator (!), так как Required проверит на уровне ModelState

        /// <summary>
        /// Опциональный комментарий при изменении статуса.
        /// </summary>
        public string? Comment { get; set; }

        /// <summary>
        /// Опциональные заметки, которые можно обновить одновременно с изменением статуса.
        /// </summary>
        public string? Notes { get; set; }
    }
}
