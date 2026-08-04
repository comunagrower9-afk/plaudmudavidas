# Arquitetura dos Portais Frontend — Plaud Note

Este documento descreve a arquitetura técnica, segurança, tipagem e componentes dos portais do Cliente e do Administrador.

---

## 1. Rotas e Páginas da Aplicação

O roteamento é gerenciado via `react-router-dom` com suporte completo a SPA e rewrites no `vercel.json`:

| Rota | Componente | Acesso | Descrição |
| :--- | :--- | :--- | :--- |
| `/` | `App.tsx` | Público | Landing page institucional de alta conversão (checkout, UTMs e Pixel preservados). |
| `/entrar` | `CustomerLoginPage.tsx` | Público | Login por OTP de 6 dígitos para clientes (`shouldCreateUser: true`). |
| `/minha-conta` | `CustomerOrdersPage.tsx` | Cliente Autenticado | Listagem mobile-first de pedidos do cliente (protegido por RLS). |
| `/minha-conta/pedidos/:id` | `CustomerOrderDetailPage.tsx` | Cliente Autenticado | Detalhes do pedido, itens, endereço e link direto seguro da 17TRACK. |
| `/admin/login` | `AdminLoginPage.tsx` | Público | Login por OTP de 6 dígitos restrito a administradores (`shouldCreateUser: false`). |
| `/admin/pedidos` | `AdminOrdersPage.tsx` | Admin Autenticado | Painel de busca, visualização de pedidos, alerta de endereço incompleto e despacho. |

---

## 2. Padrão de Autorização e Segurança (Zero Trust)

### Portal do Cliente (RLS)
- O cliente autentica-se com e-mail e código OTP de 6 dígitos via Supabase Auth.
- Após o login, a RPC `claim_customer_account()` vincula o `auth.uid()` aos pedidos vinculados ao mesmo e-mail.
- Todas as consultas às tabelas `orders` e `order_items` utilizam as políticas nativas de **Row Level Security (RLS)** do PostgreSQL.
- O cliente só consegue visualizar pedidos onde `orders.customer_id` corresponde ao seu registro de cliente.

### Painel Administrativo (Exclusividade de RPCs)
- O administrador **nunca realiza consultas diretas (`supabase.from('orders')`)**.
- Todas as operações administrativas são realizadas via RPCs dedicadas com `SECURITY DEFINER` e checagem estrita da tabela `public.admin_users`:
  - `public.current_user_is_admin()`: Verificação de privilégio.
  - `public.admin_search_orders(p_query, p_limit, p_offset)`: Busca paginada com escape seguro de curingas SQL.
  - `public.admin_get_order(p_order_id)`: Consulta completa com itens, endereço e histórico de rastreio.
  - `public.admin_register_order_shipment(p_order_id, p_tracking_code, p_carrier, p_replace_existing)`: Registro de rastreamento com auditoria imutável (`admin_audit_events`).

---

## 3. Tratamento de Endereços

A função `validateShippingAddress()` no arquivo `src/lib/portal-utils.ts` garante que dados incompletos sejam identificados:
- **Ausência de Campos:** Identifica falta de `street`, `number`, `city`, `state` ou `zip_code`.
- **Casos Especiais de Número:**
  - Valores vazios, nulos ou somente espaços são marcados como ausentes e renderizados como `Número não informado`.
  - Variantes explícitas sem número (`S/N`, `SN`, `SEM NÚMERO`) são consideradas válidas e normalizadas para `S/N`.
- **Alerta no Admin:** Exibido com destaque antes do formulário de despacho para evitar envios para endereços incompletos.
- **Área do Cliente:** Exibe aviso discreto para responder ao e-mail de confirmação caso o endereço precise de retificação.

---

## 4. Validação de Rastreamento e 17TRACK

- **Formato do Código:** Aceita de 6 a 50 caracteres alfanuméricos (`^[A-Z0-9]{6,50}$`).
- **Substituição Segura:** Se o pedido já tiver código de rastreamento cadastrado, a interface exige confirmação explícita via checkbox antes de enviar `p_replace_existing: true`.
- **Link 17TRACK:** Validado estritamente via `isValid17TrackUrl()` para apontar somente para `https://www.17track.net/pt?nums=<CODIGO>` com atributos `rel="noopener noreferrer"`.
