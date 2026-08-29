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

O site **deve** publicar a pasta `dist/` (build Vite), não o código-fonte.

1. GitHub → **Settings → Pages → Source: GitHub Actions**
2. Cada push em `main` roda [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml)
3. Verifique que o site carrega `/manifesto-pasajeros-argentina/assets/main-*.js` (não `/src/main.js`)


```bash
npm install
npm run dev      # http://localhost:5173/manifesto-pasajeros-argentina/
npm test         # Vitest (MRZ, nacionalidade, Excel)
npm run test:biff
npm run build    # dist/ para GitHub Pages
```

## Stack

- Vite 6 + Tailwind 4
- Tesseract.js (OCR em foto fixa da galeria)
- Patch BIFF8 in-place (preserva o `.xls` original byte a byte)
