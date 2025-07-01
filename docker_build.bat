@echo off

docker buildx create --use || echo Buildx instance already exists

for /f "tokens=2 delims==" %%I in ('"wmic os get localdatetime /value | findstr LocalDateTime"') do set datetime=%%I

set VERSION=%datetime:~0,4%%datetime:~4,2%%datetime:~6,2%%datetime:~8,2%%datetime:~10,2%

docker buildx build --platform linux/amd64 -t jarebear/invigo-server:%VERSION% -t jarebear/invigo-server:latest --push .

echo Multi-architecture Docker image build and push complete.