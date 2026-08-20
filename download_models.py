import os
import urllib.request

os.makedirs('tessdata', exist_ok=True)
urls = {
    'tha.traineddata.gz': 'https://raw.githubusercontent.com/naptha/tessdata/gh-pages/4.0.0_fast/tha.traineddata.gz',
    'eng.traineddata.gz': 'https://raw.githubusercontent.com/naptha/tessdata/gh-pages/4.0.0_fast/eng.traineddata.gz'
}

for name, url in urls.items():
    dest = os.path.join('tessdata', name)
    if not os.path.exists(dest) or os.path.getsize(dest) < 1000:
        print(f'Downloading {name}...')
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req) as resp, open(dest, 'wb') as f:
            f.write(resp.read())
        print(f'Saved {name} ({os.path.getsize(dest)} bytes)')
    else:
        print(f'{name} already exists ({os.path.getsize(dest)} bytes)')

print('ALL_MODELS_READY')
