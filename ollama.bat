@echo off
chcp 65001 >nul
cd /d D:\PixelSmile\ChunkaoCompanion\data\ollama

llama-server.exe ^
 -m "Qwen3.6-35B-A3B-UD-Q4_K_M.gguf" ^
 --mmproj "mmproj-BF16.gguf" ^
 -ngl 99 ^
 --n-cpu-moe 999 ^
 --flash-attn on ^
 --jinja ^
 -c 32768 ^
 -t 12 ^
 -b 512 ^
 -ub 128 ^
 --cache-type-k q4_0 ^
 --cache-type-v q4_0 ^
 --mlock ^
 --host 127.0.0.1 ^
 --port 8080

pause