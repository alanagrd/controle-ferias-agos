# Como subir esse código pro GitHub e conectar no Vercel

1. Abra o Terminal nesta pasta (`agos-rh-ferias e aso`).
2. Copie `.env.local.example` para `.env.local` (esse arquivo já está no .gitignore, não vai pro GitHub):
   ```
   cp .env.local.example .env.local
   ```
3. Rode:
   ```
   git init
   git add .
   git commit -m "Sistema de RH - Controle de Ferias (Next.js + Supabase)"
   git branch -M main
   git remote add origin https://github.com/alanagrd/controle-ferias-agos.git
   git push -u origin main
   ```
   (o terminal vai pedir pra autenticar no GitHub — use sua conta/chave normalmente)
4. No Vercel, importe o repositório `controle-ferias-agos` como um novo projeto.
5. Nas configurações do projeto no Vercel, em Environment Variables, adicione:
   - `NEXT_PUBLIC_SUPABASE_URL` = `https://drelgoarjnyzvtmuqtns.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = (o valor que está no .env.local.example)
6. Deploy. A partir daí, todo push na branch `main` faz deploy automático.

## Login de teste
- E-mail: alan.agrd@gmail.com
- Senha: **não fica no repositório** (repo público). Peça a senha por fora — canal privado / gerenciador de senhas.
