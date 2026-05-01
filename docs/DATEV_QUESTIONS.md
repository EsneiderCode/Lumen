# Preguntas para Beatriz / Janet — DATEV Export Format

> Lumen va a producir un archivo que vos importás en DATEV. Estas son las preguntas que necesitamos resolver antes de codear el export. Cuanto más concreta la respuesta, más rápido lo armamos.

---

## 1. Formato exacto

¿Cuál de estos importás hoy?

- [ ] **DATEV-Format ASCII** (Buchungsstapel clásico, txt fixed-width, header `EXTF`)
- [ ] **DATEV-Format CSV / EXTF v9** (CSV moderno con cabecera, ; como separador, encoding ISO-8859-1)
- [ ] **DATEV Online (XML)** vía API
- [ ] Otro tool de pasarela (Lexoffice, Sevdesk, Agenda) que ingiere CSV propio
- [ ] Solo manual: copiás los datos a mano

**Nuestro default si no hay info: EXTF CSV v9.**

---

## 2. Cuentas contables (Konto / Gegenkonto)

Necesitamos un mapeo cliente → número de cuenta deudora (`Konto`) y un número de cuenta de ingresos (`Gegenkonto`).

| Cliente | Konto (Debitor) en DATEV | Gegenkonto (Erlöse) |
|---|---|---|
| Insyte Deutschland GmbH | ___ | ___ |
| Vancom IT GmbH          | ___ | ___ |
| Órdenes directas (sin cliente) | ___ | ___ |

Sospecha por defecto si Beatriz no responde:
- Konto 10000-69999 = Debitor (cada cliente uno)
- Gegenkonto **8400** = Erlöse 19% USt

---

## 3. Steuersatz (IVA)

¿Aplicamos siempre 19% sobre todas las facturas, o hay excepciones?

- [ ] Siempre 19% USt
- [ ] Algunos servicios al 7% (cuáles)
- [ ] Reverse charge / sin IVA para clientes intra-UE (cuáles)

---

## 4. Período y cadencia de import

- ¿Cada cuánto importás a DATEV?
  - [ ] Diario
  - [ ] Semanal
  - [ ] Mensual (último día)
  - [ ] Por demanda
- ¿Querés un export por período (ej. todas las órdenes facturadas en el mes), o vos decidís cuáles incluir cada vez?

---

## 5. Belegnummer

DATEV pide un número de comprobante por línea. Tenemos dos opciones:

- [ ] Usar el `order_number` interno de Lumen (ej. `LUM-20260428-0001`) — fácil para nosotros
- [ ] Generar un `Belegnummer` correlativo dedicado (ej. `2026-0001` arrancando de 1 cada año) — vos lo configurás en DATEV

¿Cuál preferís?

---

## 6. Buchungstext

Texto que aparece en cada línea contable. Propuesta default:

> `Auftrag {order_number} - {project_code} - {operator_code}`

Ejemplo: `Auftrag LUM-20260428-0001 - HXT - DGF`

¿Te sirve? ¿Querés más/menos info?

---

## 7. Estados que disparan export

¿Qué estados deben aparecer en el export?

- [ ] Solo órdenes en estado `invoiced` (lo lógico)
- [ ] También las en `client_accepted` (todavía no facturadas, como pre-vista)
- [ ] Ambos en sheets separados

---

## 8. Archivos múltiples o uno solo

Si exportamos N órdenes:

- [ ] Un único archivo CSV con N líneas (default)
- [ ] Un archivo por cliente (más fácil para vos importar?)
- [ ] Un archivo por mes

---

## 9. Test de import

¿Tenés un entorno de **DATEV de prueba** donde podamos importar 1-2 órdenes para validar antes del go-live? O mandás un archivo de muestra de un import histórico que funcionó, así copiamos el formato exacto.

---

## 10. Quién recibe el export

- [ ] Vos (Beatriz) lo descargás manualmente desde Lumen
- [ ] Email automático cada vez que se genera
- [ ] Telegram/notification?
- [ ] Carpeta compartida (Dropbox, Google Drive, OneDrive)

---

## Email/Telegram body listo para mandar

Copiar y pegar:

> Hola Beatriz / Janet,
> 
> Estamos por terminar el módulo de facturación en Lumen. La idea es que cuando una orden se marca como facturada, Lumen genere un archivo que vos podés importar directamente en DATEV — sin tener que tipear cada línea.
> 
> Antes de codearlo necesito que me confirmes algunas cosas técnicas. Te paso este checklist (lleva 10 min):
> 
> [pegar las 10 preguntas de arriba]
> 
> Idealmente si tenés un archivo de muestra de un import que ya funcionó en DATEV, mandámelo — así nos ahorramos las dudas y copiamos el formato exacto que ya te sirve.
> 
> Mil gracias!
> Jarl
