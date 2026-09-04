"use client";

/**
 * 讯飞语音听写（IAT）前端直连识别。
 * 参考：NewLearnEnglish/LearnEnglish/wwwroot/js/xunfeiaudio.js
 *
 * 安全提示：讯飞 apiSecret/apiKey 直接暴露在前端存在泄露风险，此实现沿用旧项目
 * 「浏览器直连」方案（用户明确要求）。生产环境更安全的做法是由后端签发鉴权 URL。
 */

const CONFIG = {
  appId: "b61a9681",
  apiKey: "6bfb85fba69d0c53ec94a2fcc327503b",
  apiSecret: "YmM1ZmVmYjQ4YmExZjEwNTI5YzQ5ZGNl",
  host: "iat-api.xfyun.cn",
  path: "/v2/iat",
  sampleRate: 16000,
} as const;

/** 识别控制器：调用 stop() 结束录音，result 在识别完成/超时后 resolve */
export interface XunfeiSession {
  stop: () => void;
  result: Promise<boolean>;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";

  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }

  return btoa(binary);
}

function utf8ToBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = "";

  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }

  return btoa(binary);
}

/** 使用 Web Crypto 生成 HMAC-SHA256 鉴权串（替代 CryptoJS） */
async function generateAuthorization(date: string): Promise<string> {
  const signStr = `host: ${CONFIG.host}\ndate: ${date}\nGET ${CONFIG.path} HTTP/1.1`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(CONFIG.apiSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(signStr),
  );
  const base64Sig = arrayBufferToBase64(sig);
  const authorizationOrigin = `api_key="${CONFIG.apiKey}", algorithm="hmac-sha256", headers="host date request-line", signature="${base64Sig}"`;

  return utf8ToBase64(authorizationOrigin);
}

/** Float32 (-1~1) 转 16bit L16 PCM（小端） */
function float32ToL16(input: Float32Array): ArrayBuffer {
  const buffer = new ArrayBuffer(input.length * 2);
  const view = new DataView(buffer);

  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));

    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }

  return buffer;
}

/**
 * 开始讯飞识别。返回控制器，result 表示识别文本是否包含目标单词。
 * @param word 目标单词
 */
export async function startXunfeiRecognition(
  word: string,
): Promise<XunfeiSession> {
  let ws: WebSocket | null = null;
  let audioContext: AudioContext | null = null;
  let processor: ScriptProcessorNode | null = null;
  let source: MediaStreamAudioSourceNode | null = null;
  let mediaStream: MediaStream | null = null;
  let sendTimer: ReturnType<typeof setInterval> | null = null;
  const pcmQueue: ArrayBuffer[] = [];
  let recognizedText = "";
  let finished = false;
  let resolveResult: (v: boolean) => void = () => {};

  const result = new Promise<boolean>((resolve) => {
    resolveResult = resolve;
  });

  const cleanup = () => {
    if (sendTimer) {
      clearInterval(sendTimer);
      sendTimer = null;
    }
    try {
      processor?.disconnect();
    } catch {
      /* noop */
    }
    try {
      source?.disconnect();
    } catch {
      /* noop */
    }
    processor = null;
    source = null;
    mediaStream?.getTracks().forEach((t) => t.stop());
    mediaStream = null;
    if (audioContext && audioContext.state !== "closed") {
      void audioContext.close();
    }
    audioContext = null;
  };

  const settle = (v: boolean) => {
    if (finished) return;
    finished = true;
    cleanup();
    try {
      ws?.close();
    } catch {
      /* noop */
    }
    ws = null;
    resolveResult(v);
  };

  const stop = () => {
    // 通知讯飞结束音频流；等待其返回最终结果后 settle。
    if (ws && ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify({ data: { status: 2 } }));
      } catch {
        /* noop */
      }
    }
    // 停止本地采集，但保留 WS 以接收最终结果
    if (sendTimer) {
      clearInterval(sendTimer);
      sendTimer = null;
    }
    try {
      processor?.disconnect();
      source?.disconnect();
    } catch {
      /* noop */
    }
    mediaStream?.getTracks().forEach((t) => t.stop());
    // 兜底：1.2s 内未收到最终帧则以已识别文本判定
    setTimeout(() => {
      if (!finished) {
        settle(
          recognizedText
            .toLowerCase()
            .includes(word.trim().toLowerCase()),
        );
      }
    }, 1200);
  };

  try {
    audioContext = new AudioContext({ sampleRate: CONFIG.sampleRate });
    mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        sampleRate: CONFIG.sampleRate,
        channelCount: 1,
        echoCancellation: true,
      },
    });

    source = audioContext.createMediaStreamSource(mediaStream);
    processor = audioContext.createScriptProcessor(4096, 1, 1);
    processor.onaudioprocess = (e) => {
      const input = e.inputBuffer.getChannelData(0);

      pcmQueue.push(float32ToL16(input));
    };
    source.connect(processor);
    processor.connect(audioContext.destination);

    const date = new Date().toUTCString();
    const authorization = await generateAuthorization(date);
    const url = `wss://${CONFIG.host}${CONFIG.path}?host=${CONFIG.host}&date=${encodeURIComponent(
      date,
    )}&authorization=${encodeURIComponent(authorization)}`;

    ws = new WebSocket(url);
    ws.binaryType = "arraybuffer";

    ws.onopen = () => {
      ws?.send(
        JSON.stringify({
          common: { app_id: CONFIG.appId },
          business: {
            language: "en_us",
            accent: "mandarin",
            domain: "iat",
            sample_rate: String(CONFIG.sampleRate),
            vad_eos: 1000,
            nbest: 5,
          },
          data: { status: 0 },
        }),
      );

      sendTimer = setInterval(() => {
        if (pcmQueue.length > 0 && ws?.readyState === WebSocket.OPEN) {
          const chunk = pcmQueue.shift();

          if (chunk) {
            ws.send(
              JSON.stringify({
                data: { status: 1, audio: arrayBufferToBase64(chunk) },
              }),
            );
          }
        }
      }, 40);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data as string);

        if (data.code !== 0) return;

        const wsResult = data?.data?.result?.ws;

        if (Array.isArray(wsResult)) {
          const text = wsResult
            .map((item: { cw: { w: string }[] }) =>
              item.cw.map((w) => w.w.replace(/\s+/g, "").toLowerCase()).join(""),
            )
            .join("");

          recognizedText += text;
        }

        if (data?.data?.status === 2) {
          settle(
            recognizedText.toLowerCase().includes(word.trim().toLowerCase()),
          );
        }
      } catch {
        /* 忽略解析异常 */
      }
    };

    ws.onerror = () => settle(false);
    ws.onclose = () => {
      if (!finished) {
        settle(
          recognizedText.toLowerCase().includes(word.trim().toLowerCase()),
        );
      }
    };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[xunfei] 启动识别失败:", err);
    settle(false);
  }

  return { stop, result };
}
