// tracer.js
const { NodeSDK } = require('@opentelemetry/sdk-node');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-otlp-proto');
const { HttpInstrumentation } = require('@opentelemetry/instrumentation-http'); 
const { ExpressInstrumentation } = require('@opentelemetry/instrumentation-express');
const { PrometheusExporter } = require('@opentelemetry/exporter-prometheus');

const sdk = new NodeSDK({
  serviceName: 'eticaret-magaza-v3',
  traceExporter: new OTLPTraceExporter({
    url: 'http://localhost:4318/v1/traces', 
  }),
  metricReader: new PrometheusExporter({
    port: 9464, // Prometheus metrikleri buradan dinleyecek
    disableExemplars: false // 🚀 İŞTE ARADIĞIMIZ SİHİRLİ DOKUNUŞ BURASI!
  }),
  instrumentations: [
    new HttpInstrumentation(),
    new ExpressInstrumentation()
  ]
});

sdk.start();
console.log("📡 [OTel] Trace (Jaeger) ve Metrik (Prometheus) arka planda hazır.");