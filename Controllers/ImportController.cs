using MES_ME.Server.Data;
using MES_ME.Server.DTOs;
using MES_ME.Server.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MiniExcelLibs;
using Npgsql;
using System.Data;
using System.Globalization;
using System.Security.Claims;


namespace MES_ME.Server.Controllers
{
    [Authorize(Roles = "superadmin,developer")]
    [Route("api/[controller]")]
    [ApiController]
    public class ImportController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly string _connectionString;

        public ImportController(AppDbContext context)
        {
            _context = context;
            _connectionString = context.Database.GetConnectionString()
                ?? throw new InvalidOperationException("Connection string is not configured.");
        }


        // Вспомогательный метод для безопасного преобразования значений из Excel в строки для загрузки в TEXT столбцы
        private object ConvertValueToString(object value)
        {
            if (value == null || value == DBNull.Value)
            {
                return DBNull.Value;
            }

            // Преобразуем любое значение в строку, обрезая пробелы
            var stringValue = value.ToString()?.Trim();
            // Если строка пустая или "-", считаем как NULL
            if (string.IsNullOrEmpty(stringValue) || stringValue == "-")
            {
                return DBNull.Value;
            }
            return stringValue;
        }
        
       

        // Вспомогательный метод для получения значения из строки данных по индексу столбца
        private object GetValueByIndex(IDictionary<string, object> dict, int index)
        {
            var values = dict.Values;
            if (index >= 0 && index < values.Count)
            {
                return values.ElementAt(index);
            }
            return null; // Это будет конвертировано в DBNull.Value в ConvertValue
        }

        [HttpPost("upload-excel")]
        public async Task<IActionResult> UploadExcel(IFormFile file)
        {
            if (file == null || file.Length == 0)
                return BadRequest("Файл не выбран или пуст.");

            if (!Path.GetExtension(file.FileName).Equals(".xlsx", StringComparison.OrdinalIgnoreCase))
                return BadRequest("Поддерживается только формат .xlsx");

            var tempFileName = $"{Path.GetRandomFileName()}.xlsx";
            var tempFilePath = Path.Combine(Path.GetTempPath(), tempFileName);
            try
            {
                using (var stream = new FileStream(tempFilePath, FileMode.Create))
                {
                    await file.CopyToAsync(stream);
                }

                // --- ШАГ 1: Чтение Excel с помощью MiniExcel ---
                var rowsWithHeaders = MiniExcel.Query(tempFilePath, useHeaderRow: false, sheetName: "База ММК").ToList();
                if (rowsWithHeaders == null || !rowsWithHeaders.Any())
                    return BadRequest("Файл не содержит данных для импорта.");

                if (rowsWithHeaders.Count < 1)
                    return BadRequest("Файл содержит заголовки, но не содержит данных.");

                var dataRows = rowsWithHeaders.Skip(1).ToList();
                if (!dataRows.Any())
                    return BadRequest("Файл содержит заголовки, но не содержит данных для импорта.");

                // --- ШАГ 2: Фильтрация и проверка строк перед загрузкой ---
                var validDataForCopy = new List<object[]>();
                var seenKeys = new HashSet<string>(); // Для отслеживания дубликатов в рамках одной загрузки

                foreach (var rowObj in dataRows)
                {
                    var rowDict = (IDictionary<string, object>)rowObj;
                    // Получаем значения ключевых полей из строки Excel (по индексу столбца)
                    // Индексы: melt_number=4, batch_number=5, pack_number=6, sheet_number=16 (см. предыдущий код)
                    var meltNum = ConvertValueToString(GetValueByIndex(rowDict, 4)) as string;
                    var batchNum = ConvertValueToString(GetValueByIndex(rowDict, 5)) as string;
                    var packNum = ConvertValueToString(GetValueByIndex(rowDict, 6)) as string;
                    var sheetNum = ConvertValueToString(GetValueByIndex(rowDict, 16)) as string;

                    // Проверяем, есть ли хотя бы одно из ключевых полей
                    if (string.IsNullOrEmpty(meltNum) || string.IsNullOrEmpty(batchNum) || string.IsNullOrEmpty(packNum) || string.IsNullOrEmpty(sheetNum))
                    {
                        // Пропускаем строку, если ключевые поля пусты
                        continue;
                    }

                    // Формируем ключ для проверки дубликата
                    var key = $"{meltNum}|{batchNum}|{packNum}|{sheetNum}";

                    // Проверяем, встречался ли такой ключ в этой же загрузке
                    if (seenKeys.Contains(key))
                    {
                        // Пропускаем дубликат в рамках одной загрузки
                        Console.WriteLine($"Предупреждение: Обнаружен дубликат в файле для ключа: {key}. Строка пропущена.");
                        continue;
                    }

                    seenKeys.Add(key);

                    // Если строка прошла проверку, готовим её для загрузки в inputdata_raw
                    var rowData = new object[54]; // 54 столбца: status + 53 поля из Excel
                    rowData[0] = "Подготовлен к прокату"; // status
                    rowData[1] = ConvertValueToString(GetValueByIndex(rowDict, 0)); // certificate_number
                    rowData[2] = ConvertValueToString(GetValueByIndex(rowDict, 1)); // short_order_number
                    rowData[3] = ConvertValueToString(GetValueByIndex(rowDict, 2)); // commercial_order_number
                    rowData[4] = ConvertValueToString(GetValueByIndex(rowDict, 3)); // roll_date -> TEXT
                    rowData[5] = meltNum; // melt_number
                    rowData[6] = batchNum; // batch_number
                    rowData[7] = packNum; // pack_number
                    rowData[8] = ConvertValueToString(GetValueByIndex(rowDict, 7)); // pack_system_number
                    rowData[9] = ConvertValueToString(GetValueByIndex(rowDict, 8)); // steel_grade
                    rowData[10] = ConvertValueToString(GetValueByIndex(rowDict, 9)); // sheet_dimensions
                    rowData[11] = ConvertValueToString(GetValueByIndex(rowDict, 10)); // slab_number
                    rowData[12] = ConvertValueToString(GetValueByIndex(rowDict, 11)); // actual_net_weight_kg -> TEXT
                    rowData[13] = ConvertValueToString(GetValueByIndex(rowDict, 12)); // certificate_net_weight_kg
                    rowData[14] = ConvertValueToString(GetValueByIndex(rowDict, 13)); // sheets_count -> TEXT
                    rowData[15] = ConvertValueToString(GetValueByIndex(rowDict, 14)); // sheet_weight_kg
                    rowData[16] = ConvertValueToString(GetValueByIndex(rowDict, 15)); // raw_material_kg
                    rowData[17] = sheetNum; // sheet_number
                    rowData[18] = ConvertValueToString(GetValueByIndex(rowDict, 17)); // quenching_date -> TEXT
                    rowData[19] = ConvertValueToString(GetValueByIndex(rowDict, 18)); // quenching_status
                    rowData[20] = ConvertValueToString(GetValueByIndex(rowDict, 19)); // marking
                    rowData[21] = ConvertValueToString(GetValueByIndex(rowDict, 20)); // repeated_to_date -> TEXT
                    rowData[22] = ConvertValueToString(GetValueByIndex(rowDict, 21)); // gp_acceptance_status_weight
                    rowData[23] = ConvertValueToString(GetValueByIndex(rowDict, 22)); // np_acceptance_status_weight
                    rowData[24] = ConvertValueToString(GetValueByIndex(rowDict, 23)); // scrap_acceptance_status_weight
                    rowData[25] = ConvertValueToString(GetValueByIndex(rowDict, 24)); // actual_weight -> TEXT
                    rowData[26] = ConvertValueToString(GetValueByIndex(rowDict, 25)); // non_return_scrap -> TEXT
                    rowData[27] = ConvertValueToString(GetValueByIndex(rowDict, 26)); // trimming -> TEXT
                    rowData[28] = ConvertValueToString(GetValueByIndex(rowDict, 27)); // flatness_mm -> TEXT
                    rowData[29] = ConvertValueToString(GetValueByIndex(rowDict, 28)); // defect
                    rowData[30] = ConvertValueToString(GetValueByIndex(rowDict, 29)); // note
                    rowData[31] = ConvertValueToString(GetValueByIndex(rowDict, 30)); // np_act
                    rowData[32] = ConvertValueToString(GetValueByIndex(rowDict, 31)); // mmk_claim_reason
                    rowData[33] = ConvertValueToString(GetValueByIndex(rowDict, 32)); // np_decision
                    rowData[34] = ConvertValueToString(GetValueByIndex(rowDict, 33)); // sample_cards_selection
                    rowData[35] = ConvertValueToString(GetValueByIndex(rowDict, 34)); // sample_number_vk
                    rowData[36] = ConvertValueToString(GetValueByIndex(rowDict, 35)); // ballistics_sample_send_date_1 -> TEXT
                    rowData[37] = ConvertValueToString(GetValueByIndex(rowDict, 36)); // ballistics_sample_send_date_2 -> TEXT
                    rowData[38] = ConvertValueToString(GetValueByIndex(rowDict, 37)); // ballistics_sample_send_date_3 -> TEXT
                    rowData[39] = ConvertValueToString(GetValueByIndex(rowDict, 38)); // metallography_sample_send_date_1 -> TEXT
                    rowData[40] = ConvertValueToString(GetValueByIndex(rowDict, 39)); // metallography_sample_send_date_2 -> TEXT
                    rowData[41] = ConvertValueToString(GetValueByIndex(rowDict, 40)); // hardness_sample_send_date_1 -> TEXT
                    rowData[42] = ConvertValueToString(GetValueByIndex(rowDict, 41)); // hardness_sample_send_date_2 -> TEXT
                    rowData[43] = ConvertValueToString(GetValueByIndex(rowDict, 42)); // hardness_sample_send_date_3 -> TEXT
                    rowData[44] = ConvertValueToString(GetValueByIndex(rowDict, 43)); // order_link
                    rowData[45] = ConvertValueToString(GetValueByIndex(rowDict, 44)); // igk_link
                    rowData[46] = ConvertValueToString(GetValueByIndex(rowDict, 45)); // testing_status
                    rowData[47] = ConvertValueToString(GetValueByIndex(rowDict, 46)); // gp_vp_presentation_date -> TEXT
                    rowData[48] = ConvertValueToString(GetValueByIndex(rowDict, 47)); // shipment_date -> TEXT
                    rowData[49] = ConvertValueToString(GetValueByIndex(rowDict, 48)); // order_number
                    rowData[50] = ConvertValueToString(GetValueByIndex(rowDict, 49)); // certificate_number_2
                    rowData[51] = ConvertValueToString(GetValueByIndex(rowDict, 50)); // shipped_sheets_weight_kg -> TEXT
                    rowData[52] = ConvertValueToString(GetValueByIndex(rowDict, 51)); // sheet_weight_after_to_storage_kg -> TEXT
                    rowData[53] = ConvertValueToString(GetValueByIndex(rowDict, 52)); // post_ship_diff -> TEXT

                    validDataForCopy.Add(rowData);
                }

                if (!validDataForCopy.Any())
                {
                    return BadRequest("После фильтрации не осталось строк для импорта (все строки содержали пустые ключевые поля или были дубликатами).");
                }

                // --- ШАГ 3: Вставка отфильтрованных данных в inputdata_raw и вызов процедуры ---
                using var connection = new NpgsqlConnection(_connectionString);
                await connection.OpenAsync();

                using var transaction = await connection.BeginTransactionAsync(); // Открываем транзакцию

                try
                {
                    // Используем таблицу inputdata_raw
                    using (var writer = connection.BeginBinaryImport("COPY \"mes\".\"inputdata_raw\" (\"status\", \"certificate_number\", \"short_order_number\", \"commercial_order_number\", \"roll_date\", \"melt_number\", \"batch_number\", \"pack_number\", \"pack_system_number\", \"steel_grade\", \"sheet_dimensions\", \"slab_number\", \"actual_net_weight_kg\", \"certificate_net_weight_kg\", \"sheets_count\", \"sheet_weight_kg\", \"raw_material_kg\", \"sheet_number\", \"quenching_date\", \"quenching_status\", \"marking\", \"repeated_to_date\", \"gp_acceptance_status_weight\", \"np_acceptance_status_weight\", \"scrap_acceptance_status_weight\", \"actual_weight\", \"non_return_scrap\", \"trimming\", \"flatness_mm\", \"defect\", \"note\", \"np_act\", \"mmk_claim_reason\", \"np_decision\", \"sample_cards_selection\", \"sample_number_vk\", \"ballistics_sample_send_date_1\", \"ballistics_sample_send_date_2\", \"ballistics_sample_send_date_3\", \"metallography_sample_send_date_1\", \"metallography_sample_send_date_2\", \"hardness_sample_send_date_1\", \"hardness_sample_send_date_2\", \"hardness_sample_send_date_3\", \"order_link\", \"igk_link\", \"testing_status\", \"gp_vp_presentation_date\", \"shipment_date\", \"order_number\", \"certificate_number_2\", \"shipped_sheets_weight_kg\", \"sheet_weight_after_to_storage_kg\", \"post_ship_diff\") FROM STDIN (FORMAT BINARY)"))
                    {
                        foreach (var record in validDataForCopy)
                        {
                            writer.WriteRow(record);
                        }
                        await writer.CompleteAsync();
                    }

                    // --- ШАГ 4: Вызов процедуры преобразования ---
                    using (var cmd = new NpgsqlCommand("CALL mes.migrate_raw_to_main();", connection, transaction))
                    {
                        cmd.CommandTimeout = 300; // Увеличиваем таймаут на 5 минут, если данных много
                        await cmd.ExecuteNonQueryAsync();
                    }

                    await transaction.CommitAsync(); // Коммитим транзакцию только если всё успешно

                    return Ok(new { message = $"Успешно загружено {validDataForCopy.Count} строк в сыром виде. Преобразование в целевую таблицу выполнено успешно." });
                }
                catch (Exception ex)
                {
                    await transaction.RollbackAsync(); // Откатываем, если произошла ошибка
                    Console.WriteLine($"Ошибка при загрузке/преобразовании данных: {ex.Message}");
                    return StatusCode(500, new { message = "Произошла ошибка при загрузке или преобразовании данных.", error = ex.Message });
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Ошибка импорта: {ex.Message}");
                return StatusCode(500, new { message = "Произошла ошибка при импорте данных.", error = ex.Message });
            }
            finally
            {
                if (System.IO.File.Exists(tempFilePath))
                {
                    System.IO.File.Delete(tempFilePath);
                }
            }
        }

        // --- МЕТОД: Изменение статуса листа (для мастера/суперадмина) ---
        // Добавим его перед закрывающей скобкой класса
        [HttpPut("update-sheet-status/{matId}")]
        public async Task<IActionResult> UpdateSheetStatus(string matId, [FromBody] UpdateSheetStatusRequest request)
        {
            // Проверка аутентификации и авторизации (только для 'master' или 'superadmin')
            if (!User.IsInRole("master") && !User.IsInRole("superadmin") && !User.IsInRole("developer"))
                {
                    return Forbid(); // Forbidden
                }

            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            // Проверяем, существует ли лист
            var sheet = await _context.InputData.FindAsync(matId);
            if (sheet == null)
            {
                return NotFound(new { message = $"Лист с MatId {matId} не найден." });
            }

            // Опционально: проверить, является ли новый статус допустимым
            var validStatuses = new[]
            {
                "Подготовлен к прокату",
                "Прошел закалку",
                "Добавлен в кассету",
                "Прошел отпуск",
                "Недокат",
                "Чистый выброс"
            };

            if (!validStatuses.Contains(request.NewStatus, StringComparer.OrdinalIgnoreCase))
            {
                return BadRequest(new { message = "Указанный статус недопустим." });
            }

            // Обновляем статус
            sheet.Status = request.NewStatus;

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateException ex)
            {
                // Логирование ошибки (ILogger)
                Console.WriteLine($"Ошибка при обновлении статуса листа: {ex.Message}");
                return StatusCode(500, new { message = "Произошла ошибка при обновлении статуса листа." });
            }

            return Ok(new { message = $"Статус листа {matId} успешно изменён на '{request.NewStatus}'." });
        }


    }
}