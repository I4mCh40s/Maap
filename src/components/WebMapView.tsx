// src/components/WebMapView.tsx
import React, { useRef, useEffect } from 'react';

export type WebMapViewProps = {
  html: string;
  jsToInject?: { code: string; timestamp: number };
  onMessage: (event: { nativeEvent: { data: string } }) => void;
  onLoad?: () => void;
};

const WebMapView: React.FC<WebMapViewProps> = ({
  html,
  jsToInject,
  onMessage,
  onLoad,
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // 1️⃣ Listen for messages from the iframe → mimic react-native-webview
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      // Only forward messages coming from our iframe
      if (e.source === iframeRef.current?.contentWindow && e.data != null) {
        // Always send a string so MapScreen can JSON.parse it
        const dataString = typeof e.data === 'string'
          ? e.data
          : JSON.stringify(e.data);
        onMessage({ nativeEvent: { data: dataString } });
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [onMessage]);

  // 2️⃣ Whenever jsToInject changes, post it into the iframe
  useEffect(() => {
    if (jsToInject?.code && iframeRef.current?.contentWindow) {
      // 🚨 Must stringify here, so the page’s JSON.parse can work
      iframeRef.current.contentWindow.postMessage(
        JSON.stringify({ type: 'EXEC_JS', code: jsToInject.code }),
        '*'
      );
    }
  }, [jsToInject]);

  return (
    <iframe
      ref={iframeRef}
      srcDoc={html}
      style={{ width: '100%', height: '100%', border: 'none' }}
      sandbox="allow-scripts allow-same-origin"
      onLoad={onLoad}
    />
  );
};

export default WebMapView;
