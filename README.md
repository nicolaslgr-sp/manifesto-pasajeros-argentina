# Manifesto de Pasajeros — Argentina

App web para preencher o **Manifiesto de Pasajeros** (Anexo I, Resolución 2997/85), otimizada para **iPhone / Safari**.

**URL:** https://nicolaslgr-sp.github.io/manifesto-pasajeros-argentina/

## Uso no iPhone

1. Tire a foto da **página inteira** do passaporte com o app **Câmera** (boa luz, sem reflexo).
2. Abra o manifesto no Safari → toque **Galeria / Foto** → escolha essa foto.
3. Aguarde a leitura (~10–20 s) e confira nome, data de nascimento, nacionalidade e passaporte.
4. Preencha cabeçalho e guia se necessário.
5. Toque **Baixar Excel (.xls)** — o arquivo é o modelo oficial preenchido (ENTRADA + SALIDA).

## Privacidade

Tudo roda **no navegador**. Dados ficam no `localStorage` do iPhone; fotos e passaportes **não são enviados** a nenhum servidor.

## Deploy (GitHub Pages)

O site **deve** publicar o build Vite (`dist/`), não o código-fonte em `/src/`.

**Opção A (recomendada):** Settings → Pages → Source → **GitHub Actions**

**Opção B:** Settings → Pages → Source → **Deploy from branch** → `main` → pasta **`/docs`**

A pasta [`docs/`](docs/) contém o build pronto (gerado com `npm run build:pages`).  
Verifique no site que o HTML referencia `/manifesto-pasajeros-argentina/assets/main-*.js` — **não** `/src/main.js`.


```bash
npm install
npm run dev      # http://localhost:5173/manifesto-pasajeros-argentina/ (usa index.dev.html)
npm test
npm run build:pages   # gera dist/, docs/ e publica build na raiz (index.html + assets/)
npm run build
```

## Stack

- Vite 6 + Tailwind 4
- Tesseract.js (OCR em foto fixa da galeria)
- Patch BIFF8 in-place (preserva o `.xls` original byte a byte)
