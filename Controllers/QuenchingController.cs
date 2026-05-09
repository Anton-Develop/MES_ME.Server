using Microsoft.AspNetCore.Mvc;
using MES_ME.Server.Repositories;
using MES_ME.Server.Models;

namespace MES_ME.Server.Controllers;

[ApiController]
[Route("api/[controller]")]
public class QuenchingController : ControllerBase
{
    private readonly IQuenchingRepository _repo;

    public QuenchingController(IQuenchingRepository repo) => _repo = repo;

    /// <summary>
    /// Количество сессий с учётом фильтров
    /// </summary>
    [HttpGet("count")]
    public async Task<ActionResult<int>> GetCount(
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to,
        [FromQuery] int? slab,
        [FromQuery] int? melt,
        [FromQuery] int? alloyCode)
    {
        var count = await _repo.GetSessionCountAsync(from, to, slab, melt, alloyCode, HttpContext.RequestAborted);
        return Ok(count);
    }

    /// <summary>
    /// Пагинированный список сессий
    /// </summary>
    [HttpGet("list")]
    public async Task<ActionResult<IEnumerable<QuenchingSession>>> GetList(
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to,
        [FromQuery] int? slab,
        [FromQuery] int? melt,
        [FromQuery] int? alloyCode,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        int offset = (page - 1) * pageSize;
        var list = await _repo.GetSessionListAsync(from, to, slab, melt, alloyCode, pageSize, offset, HttpContext.RequestAborted);
        return Ok(list);
    }

    /// <summary>
    /// Сессия по бизнес-ключу (например, "44|0|102247|412|3|0")
    /// </summary>
    [HttpGet("{businessKey}")]
    public async Task<ActionResult<QuenchingSession>> GetByKey(string businessKey)
    {
        var session = await _repo.GetSessionByKeyAsync(businessKey, HttpContext.RequestAborted);
        if (session is null) return NotFound();
        return Ok(session);
    }

    /// <summary>
    /// Все сессии для листа
    /// </summary>
    [HttpGet("by-sheet/{sheet}")]
    public async Task<ActionResult<IEnumerable<QuenchingSession>>> GetBySheet(int sheet)
    {
        var sessions = await _repo.GetSessionsBySheetAsync(sheet, HttpContext.RequestAborted);
        return Ok(sessions);
    }
}