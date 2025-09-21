# Tech Talk: Service Workers com React

## Do nosso último talk...

Web Workers vs Shared Workers vs Service Workers

```
| Recurso / Capacidade             | Web Worker                          | Shared Worker                             | Service Worker*                                   |
|----------------------------------+-------------------------------------+-------------------------------------------+---------------------------------------------------|
| Escopo                           | Página ou aba única                 | Compartilhado entre abas (mesma origem)   | Global (site inteiro, independente de abas)       |
| Compartilhado entre abas         | Não                                 | Sim                                       | Sim                                               |
| Comunicação                      | `postMessage` (1:1)                 | `port.postMessage` (muitos:1)             | `postMessage`, `fetch`, Push API, etc.            |
| Persiste após fechar a aba       | Não                                 | Não                                       | Sim (gerenciado pelo navegador)                   |
| Executado em thread separada     | Sim, thread em segundo plano        | Sim, thread em segundo plano              | Sim, thread em segundo plano (baseado em eventos) |
| Caso de uso                      | Delegar tarefas pesadas de CPU      | Coordenar lógica entre abas               | Sincronização em segundo plano, cache, push       |
| Exemplo típico                   | Processamento de imagem, computação | Reutilizar conexão com banco de dados     | Aplicativos offline, notificações push            |
| Compartilhamento de memória      | Não (exceto `SharedArrayBuffer`)    | Sim, via mensagens entre abas             | Não                                               |
| Acesso ao DOM                    | Não                                 | Não                                       | Não                                               |
| Intercepta requisições de rede   | Não                                 | Não                                       | Sim (interceptação com `fetch`)                   |
| Funciona sem interface gráfica   | Não (encerra ao fechar a página)    | Não (encerra ao fechar a última aba)      | Sim                                               |
| Requer contexto seguro (HTTPS)   | Não                                 | Não                                       | Sim (HTTPS obrigatório)                           |
| Pode armazenar recursos em cache | Não                                 | Não                                       | Sim (via Cache API)                               |
| Suporte nos navegadores          | Excelente                           | Parcial (alguns navegadores não suportam) | Excelente                                         |
```

Resumo de casos de uso:

```
| Caso de uso                         | Worker recomendado           |
|-------------------------------------+------------------------------|
| Cálculos pesados (ex: Fibonacci)    | Web Worker                   |
| Coordenação entre abas              | Shared Worker                |
| Aplicações offline                  | Service Worker               |
| Sincronização ou notificações       | Service Worker               |
| Compartilhamento de DB entre abas   | Shared Worker                |
| Processamento de imagem/áudio/vídeo | Web Worker + OffscreenCanvas |

```

## Objetivo

Explorar o uso de Service Workers em aplicações React, demonstrando:

1.  Um SPA base, SEM Service Worker
2.  Um SPA com Service Worker manual
    - Instalando e ativando o Service Worker
    - Utilizando a api Cache, pré-populando-a
    - Cacheando app para uso offline
    - Cacheanamento de chamadas externas
    - Permissão de notificações
    - Simulação de Push Notifications
3.  Um SPA com Workbox
4.  Push Notifications com Node + VAPID

Para facilitar a vida:

- [Web Workers / Shared Workers](https://github.com/GoogleChromeLabs/comlink)
- [Service Workers](https://github.com/GoogleChrome/workbox)

Referências:

- https://developer.chrome.com/docs/workbox/
- https://developer.chrome.com/docs/workbox/caching-strategies-overview#caching_strategies
- https://developer.chrome.com/docs/workbox/what-is-workbox

---

## 🚀 Introdução: O que são Service Workers?

Service Workers são um tipo especial de **Web Worker**, essencialmente scripts
JavaScript que o navegador executa em segundo plano, de forma independente da
página web. Eles atuam como um **proxy de rede programável**, permitindo
interceptar e manipular requisições de rede, gerenciar cache de respostas e
habilitar funcionalidades que antes eram exclusivas de aplicativos nativos.

### Principais Características:

- **Execução em Background:** Operam em sua própria thread, sem bloquear a
  interface do usuário.

- **Ciclo de Vida Independente:** Possuem um ciclo de vida próprio
  (`install`, `activate`, `fetch`) que é separado da página. Uma vez instalado,
  ele pode processar eventos mesmo quando a aba do seu site não está aberta.

- **Proxy de Rede:** Podem interceptar, modificar e responder a qualquer
  requisição de rede feita pela página.

- **Sem Acesso ao DOM:** Por segurança e para evitar bloqueios, Service
  Workers não têm acesso direto ao `document` ou `window`. A comunicação com a
  página é feita através da `postMessage` API.

- **Progressive Enhancement:** São projetados para serem um aprimoramento. Se
  o navegador não os suporta, a aplicação continua funcionando normalmente.

### Limitações e Requisitos:

- **HTTPS Obrigatório:** Por razões de segurança (para evitar ataques
  _man-in-the-middle_), Service Workers só podem ser registrados em páginas
  servidas sobre HTTPS. A única exceção é o `localhost`, para facilitar o
  desenvolvimento.

- **Assíncronos por Natureza:** Todas as suas APIs são baseadas em Promises,
  garantindo que não bloqueiem a thread principal.

- **Suporte do Navegador:** Embora amplamente suportado pelos navegadores
  modernos, é sempre bom verificar a compatibilidade (`'serviceWorker' in
navigator`).

- **Gerenciamento de Estado:** Não mantêm estado entre reinicializações. Para
  persistir dados, eles devem usar APIs como `Cache` ou `IndexedDB`.

---

## Mão na massa!

### 1. Aplicação React Padrão (Sem Service Worker)

Nossa base é uma aplicação React simples, criada com Vite.

- **Local:** `service-workers-demos/01-react-no-sw/`

- **Funcionalidade:** A cada carregamento, busca e exibe uma piada aleatória da
  API `official-joke-api`.

**Código Chave (`src/App.jsx`):**

```javascript
function App() {
  const [quote, setQuote] = useState("Loading...");

  useEffect(() => {
    fetch("https://official-joke-api.appspot.com/random_joke")
      .then((r) => r.json())
      .then((j) => setQuote(`${j?.setup} - ${j?.punchline}`))
      .catch(() => setQuote("❌ Error fetching quote."));
  }, []);

  return (
    <>
      <h1>App1 - Common React App</h1>
      <div className="card">
        <p>{quote}</p>
      </div>
      <button onClick={() => window.location.reload()}>Reload Page</button>
    </>
  );
}
```

**Demonstração:**

1.  Execute a aplicação (`pnpm run dev`).

2.  Mostre que ela funciona online.

3.  Abra o DevTools, vá para a aba "Network" e ative o modo "Offline".

4.  Recarregue a página. O resultado será o erro "Dinossauro" do Chrome, pois a
    aplicação não consegue acessar a rede para buscar seus assets ou a piada.

---

### 2. Adicionando um Service Worker Manualmente

Agora, vamos adicionar um Service Worker para dar superpoderes à nossa
aplicação, como funcionamento offline.

- **Local:** `service-workers-demos/02-react-sw-manual/`

#### 2.1. Registro do Service Worker

Primeiro, precisamos registrar nosso script de SW.

**Código Chave (`src/main.jsx` e `src/sw-register.js`):**

```javascript
// src/main.jsx
import { registerSW } from "./sw-register";
// ...
registerSW();

// src/sw-register.js
export function registerSW() {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("/service-worker.js") // Registra o SW que está na pasta /public
        .then((reg) => console.log(" 🟢 Registered SW:", reg))
        .catch((err) => console.error(" 🔴 Error registering SW:", err));
    });
  }
}
```

#### 2.2. Ciclo de Vida: Instalação e Ativação

O SW tem um ciclo de vida. No evento `install`, pré-cacheamos os assets
essenciais da nossa aplicação. No `activate`, limpamos caches antigos.

**Código Chave (`public/service-worker.js`):**

```javascript
const CACHE_NAME = "app-cache-v1";
const URLS_TO_PRECACHE = ["/", "vite.svg"]; // Arquivos do App Shell

// Evento de Instalação
self.addEventListener("install", (event) => {
  console.log("🔧 [SW] install");
  // Espera até que o cache seja aberto e os arquivos pré-cacheados
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(URLS_TO_PRECACHE)),
  );
  self.skipWaiting(); // Força o SW a se tornar ativo imediatamente
});

// Evento de Ativação
self.addEventListener("activate", (event) => {
  console.log("🔧 [SW] activate");
  // Limpa caches antigos que não correspondem ao CACHE_NAME atual
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)),
        ),
      ),
  );
  self.clients.claim(); // Permite que o SW controle clientes abertos imediatamente
});
```

#### 2.3. Interceptando Requisições (Fetch) para Offline

O evento `fetch` é o coração do SW. Aqui, interceptamos as requisições e
decidimos se vamos respondê-las com dados do cache ou da rede.

**Código Chave (`public/service-worker.js`):**

```javascript
self.addEventListener("fetch", (event) => {
  const req = event.request;
  event.respondWith(
    caches.match(req).then((cachedResp) => {
      // 1. Se a resposta estiver no cache, retorna-a.
      if (cachedResp) return cachedResp;

      // 2. Se não, busca na rede.
      return fetch(req)
        .then((networkResp) => {
          // 3. Se a resposta da rede for válida, clona e armazena no cache.
          if (
            req.method === "GET" &&
            networkResp &&
            networkResp.status === 200 &&
            req.url.startsWith(self.location.origin)
          ) {
            const copy = networkResp.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          }
          return networkResp;
        })
        .catch(() => {
          // 4. Se a rede falhar, retorna um fallback (ex: a página principal para navegação).
          if (req.headers.get("accept").includes("text/html")) {
            return caches.match("/index.html");
          }
          return new Response("You're offline, this resouce is not cached!", {
            status: 503,
          });
        });
    }),
  );
});
```

**Demonstração:**

1.  Execute a aplicação.

2.  Vá para a aba "Application" -> "Service Workers" no DevTools e mostre o SW
    ativo.

3.  Vá para "Cache Storage" e mostre os arquivos pré-cacheados.

4.  Coloque a aplicação em modo "Offline" e recarregue. A aplicação agora
    funciona! A piada, no entanto, mostrará um erro de fallback, pois a
    requisição para a API externa não foi cacheada pela regra
    `req.url.startsWith(self.location.origin)`.

#### 2.4. Background Sync

Permite que a aplicação adie uma ação (como um POST) até que a conexão de rede
seja restabelecida.

**Código Chave (`src/App.jsx` e `public/service-worker.js`):**

```javascript
// src/App.jsx - Agendando a sincronização
async function scheduleSendData() {
  if ("serviceWorker" in navigator && "SyncManager" in window) {
	const reg = await navigator.serviceWorker.ready;
	await reg.sync.register("send-form"); // Registra um evento de sync com a tag 'send-form'
	alert("Scheduled sending. Will be executed when back online.");
  }
}

// public/service-worker.js - Ouvindo o evento sync
self.addEventListener("sync", (event) => {
  if (event.tag === "send-form") {
	event.waitUntil(sendPendingData());
  }
});

function sendPendingData() {
  // Lógica para reenviar os dados para o servidor
  return fetch("/api/save", { method: "POST", ... });
}
```

**Demonstração:**

1.  Fique offline.

2.  Clique no botão "Schedule Data Sending".

3.  Vá para a aba "Application" -> "Background Sync" e mostre a tag pendente.

4.  Fique online. O SW tentará enviar os dados e a tag desaparecerá.

#### 2.5. Push Notifications (Simulado)

O SW pode receber mensagens push de um servidor e exibir notificações, mesmo
com o site fechado.

**Código Chave (`src/App.jsx` e `public/service-worker.js`):**

```javascript
// src/App.jsx - Pedindo permissão
function askPermission() {
  Notification.requestPermission().then((perm) => { ... });
}

// public/service-worker.js - Recebendo o push
self.addEventListener("push", (event) => {
  console.log("🔔 [SW] Push event received:", event);
  let title = "Default title";
  let body = "Hello from fake push";
  if (event.data) {
	// ... lógica para parsear os dados do push
  }
  const options = { body, icon: "/vite.svg" };
  // Exibe a notificação após 5 segundos
  event.waitUntil(self.registration.showNotification(title, options));
});
```

**Demonstração:**

1.  Clique em "Turn ON Notifications" e aceite a permissão.

2.  Vá para "Application" -> "Service Workers", encontre o SW ativo e clique no
    link "Push".

3.  Envie uma mensagem de push simulada. A notificação aparecerá.

---

### 3. Simplificando com Workbox

Escrever um SW manual pode ser complexo e repetitivo. Workbox é uma biblioteca
do Google que abstrai as melhores práticas e simplifica a criação de Service
Workers.

- **Local:** `service-workers-demos/03-react-sw-workbox/`

**Código Chave (`public/sw.js`):**
Em vez de `addEventListener` para `fetch`, usamos rotas e estratégias declarativas.

```javascript
/* global workbox */
importScripts(
  "https://storage.googleapis.com/workbox-cdn/releases/6.5.4/workbox-sw.js",
);

// Estratégia para a navegação da SPA (tenta a rede primeiro)
workbox.routing.registerRoute(
  ({ request }) => request.mode === "navigate",
  new workbox.strategies.NetworkFirst({ cacheName: "html-shell" }),
);

// Estratégia para a API de piadas (usa cache enquanto busca na rede)
workbox.routing.registerRoute(
  ({ url }) => url.origin === "https://official-joke-api.appspot.com",
  new workbox.strategies.StaleWhileRevalidate({ cacheName: "api-jokes-cache" }),
);

// Estratégia para assets (CSS, JS)
workbox.routing.registerRoute(
  ({ request }) => ["style", "script", "worker"].includes(request.destination),
  new workbox.strategies.StaleWhileRevalidate({
    cacheName: "static-resources",
  }),
);

// Background Sync com plugin
const bgSyncPlugin = new workbox.backgroundSync.BackgroundSyncPlugin(
  "form-queue",
);
workbox.routing.registerRoute(
  ({ url, request }) => request.method === "POST" && url.pathname === "/post",
  new workbox.strategies.NetworkOnly({ plugins: [bgSyncPlugin] }),
  "POST",
);
```

**Demonstração:**

1.  Mostre o código do `sw.js` e compare sua simplicidade com o SW manual.

2.  Execute a aplicação e repita os testes de offline e background sync. O
    comportamento será similar, mas o código de implementação é muito mais
    limpo e robusto.

---

### 4. Push Notifications Reais com Node.js e VAPID

Para enviar pushes de verdade, precisamos de um servidor. O protocolo VAPID
(Voluntary Application Server Identification) permite que nosso servidor se
identifique de forma segura para o serviço de push do navegador.

- **Local:** `service-workers-demos/04-push-example/`

#### Arquitetura:

- **Client (`client/`):** Uma aplicação React que pede permissão e se inscreve
  para receber pushes.

- **Server (`server/`):** Um servidor Node.js/Express que armazena as
  inscrições e envia as mensagens de push.

**Passo a Passo:**

1.  **Gerar Chaves VAPID (no servidor):**

    ```bash
    npx web-push generate-vapid-keys
    ```

    Isso gera uma chave pública e uma privada.

2.  **Configurar o Cliente (`client/src/App.jsx`):**

    - A chave pública VAPID é usada no cliente para que ele possa se inscrever
      no serviço de push correto.

    - O cliente registra o `sw-push.js`.

    - Ao clicar em "Subscribe", o cliente pede a `PushSubscription` ao
      navegador e a envia para o nosso servidor no endpoint `/subscribe`.

    ```javascript
    // client/src/App.jsx
    const PUBLIC_VAPID_KEY = "..."; // Chave pública gerada

    async function subscribeUser() {
      const reg = await navigator.serviceWorker.register("/sw-push.js");
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(PUBLIC_VAPID_KEY),
      });

      // Envia a inscrição para o servidor
      await fetch("http://localhost:4000/subscribe", {
        method: "POST",
        body: JSON.stringify(sub),
        headers: { "Content-Type": "application/json" },
      });
    }
    ```

3.  **Configurar o Servidor (`server/server.js`):**

    - Usa a biblioteca `web-push`.

    - Configura as chaves VAPID (pública e privada).

    - Cria um endpoint `/subscribe` para receber e armazenar as inscrições dos
      clientes.

    - Periodicamente (a cada 10s), envia uma notificação para todas as
      inscrições armazenadas.

    ```javascript
    // server/server.js
    const webpush = require("web-push");
    const publicVapidKey = "...";
    const privateVapidKey = "...";

    webpush.setVapidDetails(
      "mailto:test@example.com",
      publicVapidKey,
      privateVapidKey,
    );

    let subscriptions = [];

    app.post("/subscribe", (req, res) => {
      const sub = req.body;
      subscriptions.push(sub);
      res.status(201).json({ ok: true });
    });

    setInterval(() => {
      // Envia um push para todas as inscrições
      subscriptions.forEach((sub) => {
        webpush.sendNotification(
          sub,
          JSON.stringify({ title: "Server ping!" }),
        );
      });
    }, 10_000);
    ```

4.  **Service Worker do Cliente (`client/public/sw-push.js`):**

    - É extremamente simples: apenas ouve o evento `push` e exibe a notificação
      com os dados recebidos.

    ```javascript
    self.addEventListener("push", (event) => {
      const data = event.data.json();
      self.registration.showNotification(data.title, { body: data.body });
    });
    ```

**Demonstração:**

1.  Inicie o servidor (`pnpm run start`).

2.  Inicie o cliente (`pnpm run dev`).

3.  Clique em "Subscribe to push!" e aceite a permissão.

4.  Mostre no console do servidor que uma nova inscrição foi recebida.

5.  Aguarde alguns segundos. A notificação enviada pelo servidor aparecerá no
    sistema operacional.
