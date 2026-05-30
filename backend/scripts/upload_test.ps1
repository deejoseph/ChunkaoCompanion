$b = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAAWgmWQ0AAAAASUVORK5CYII='
$out = 'D:\PixelSmile\ChunkaoCompanion\temp_test_image.png'
[System.IO.File]::WriteAllBytes($out, [System.Convert]::FromBase64String($b))
$uri = 'http://localhost:3001/api/banks/upload-asset'
$client = New-Object System.Net.Http.HttpClient
$content = New-Object System.Net.Http.MultipartFormDataContent
$fileStream = [System.IO.File]::OpenRead($out)
$fileContent = New-Object System.Net.Http.StreamContent($fileStream)
$fileContent.Headers.ContentType = [System.Net.Http.Headers.MediaTypeHeaderValue]::Parse('image/png')
$content.Add($fileContent, 'file', [System.IO.Path]::GetFileName($out))
$content.Add((New-Object System.Net.Http.StringContent('test_chinese_sample')), 'bankId')
$content.Add((New-Object System.Net.Http.StringContent('q1')), 'questionId')
$response = $client.PostAsync($uri, $content).Result
$result = $response.Content.ReadAsStringAsync().Result
Write-Output $result
