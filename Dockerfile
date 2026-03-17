FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS base
WORKDIR /app
# USER app # Закомментировано

FROM --platform=$BUILDPLATFORM mcr.microsoft.com/dotnet/sdk:10.0 AS build
ARG configuration=Release
WORKDIR /src
COPY ["MES_ME.Server.csproj", "./"]
RUN dotnet restore "MES_ME.Server.csproj"
COPY . .
WORKDIR "/src/."
RUN dotnet build  "MES_ME.Server.csproj" -c $configuration -o /app/build

FROM build AS publish
ARG configuration=Release
RUN dotnet publish "MES_ME.Server.csproj" -c $configuration -o /app/publish /p:UseAppHost=false

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .

# --- Команды для отладки ---
# Вывести список файлов в /app
RUN ls -la /app/
# Проверить, установлен ли ASP.NET Core App Framework
RUN ls -la /usr/share/dotnet/shared/Microsoft.AspNetCore.App/
# Проверить, установлен ли .NET Core App Framework (базовый)
RUN ls -la /usr/share/dotnet/shared/Microsoft.NETCore.App/
# Попробовать запустить dotnet --info
RUN dotnet --info
# --------------------------

# Пока что не запускаем приложение
 ENTRYPOINT ["dotnet", "MES_ME.Server.dll"]
