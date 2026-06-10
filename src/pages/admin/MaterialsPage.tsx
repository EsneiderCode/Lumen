import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CarFront, FileSpreadsheet, PackagePlus, Plus, Save, Trash2 } from 'lucide-react'
import { TEAMS } from '@/constants/styles'
import { fetchClients } from '@/services/workOrderService'
import {
  commitMaterialImport,
  createMaterial,
  createVehicle,
  deactivateMaterial,
  deactivateVehicle,
  fetchMaterials,
  fetchVehicleStock,
  fetchVehicles,
  parseMaterialWorkbook,
  updateMaterial,
  updateVehicle,
} from '@/services/materialInventoryService'
import { useAuth } from '@/hooks/useAuth'
import type { TeamColor } from '@/types/enums'
import type {
  ClientRef,
  InventoryVehicle,
  MaterialImportPreviewRow,
  MaterialPayload,
  MaterialWithClient,
  VehiclePayload,
  VehicleStockRow,
} from '@/types/material-inventory'

const EMPTY_MATERIAL: MaterialPayload = {
  name: '',
  category: '',
  sku: '',
  catalog_client_id: '',
  catalog_source: 'manual',
  unit: 'ud',
  min_stock: 0,
  notes: '',
  is_active: true,
}

const EMPTY_VEHICLE: VehiclePayload = {
  name: '',
  team: 'rot',
  license_plate: '',
  notes: '',
  active: true,
}

function fmtQty(qty: number, unit?: string) {
  return `${Number(qty).toLocaleString('de-DE', { maximumFractionDigits: 2 })}${unit ? ` ${unit}` : ''}`
}

const iconBtnCls = 'btn btn-g btn-sm'
const primaryBtnCls = 'btn btn-p btn-sm'

export function MaterialsPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [clients, setClients] = useState<ClientRef[]>([])
  const [materials, setMaterials] = useState<MaterialWithClient[]>([])
  const [vehicles, setVehicles] = useState<InventoryVehicle[]>([])
  const [selectedVehicleId, setSelectedVehicleId] = useState('')
  const [stockRows, setStockRows] = useState<VehicleStockRow[]>([])
  const [materialForm, setMaterialForm] = useState<MaterialPayload>({ ...EMPTY_MATERIAL })
  const [editingMaterialId, setEditingMaterialId] = useState<string | null>(null)
  const [vehicleForm, setVehicleForm] = useState<VehiclePayload>({ ...EMPTY_VEHICLE })
  const [editingVehicleId, setEditingVehicleId] = useState<string | null>(null)
  const [importClientId, setImportClientId] = useState('')
  const [importVehicleId, setImportVehicleId] = useState('')
  const [previewRows, setPreviewRows] = useState<MaterialImportPreviewRow[]>([])
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const selectedVehicle = vehicles.find((v) => v.id === selectedVehicleId) ?? null
  const activeVehicles = vehicles.filter((vehicle) => vehicle.active)
  const stockAlerts = useMemo(
    () => stockRows.filter((row) => Number(row.quantity) <= Number(row.material.min_stock)),
    [stockRows],
  )

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: clientRows }, { data: materialRows }, { data: vehicleRows }] = await Promise.all([
      fetchClients(),
      fetchMaterials(true),
      fetchVehicles({ includeInactive: true }),
    ])
    setClients(clientRows as ClientRef[])
    setMaterials(materialRows)
    setVehicles(vehicleRows)
    const defaultVehicle = selectedVehicleId || vehicleRows.find((v) => v.active)?.id || ''
    setSelectedVehicleId(defaultVehicle)
    setImportVehicleId((current) => current || defaultVehicle)
    setImportClientId((current) => current || (clientRows[0]?.id ?? ''))
    setLoading(false)
  }, [selectedVehicleId])

  useEffect(() => {
    queueMicrotask(() => void load())
  }, [load])

  useEffect(() => {
    if (!selectedVehicleId) {
      queueMicrotask(() => setStockRows([]))
      return
    }
    fetchVehicleStock(selectedVehicleId).then(({ data }) => setStockRows(data))
  }, [selectedVehicleId, message])

  function resetMaterialForm() {
    setEditingMaterialId(null)
    setMaterialForm({ ...EMPTY_MATERIAL, catalog_client_id: clients[0]?.id ?? '' })
  }

  function resetVehicleForm() {
    setEditingVehicleId(null)
    setVehicleForm({ ...EMPTY_VEHICLE })
  }

  async function submitMaterial(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setMessage(null)
    if (!materialForm.name.trim() || !materialForm.category.trim() || !materialForm.catalog_client_id) {
      setError(t('materials.messages.materialRequired'))
      return
    }
    setWorking(true)
    const payload = {
      ...materialForm,
      name: materialForm.name.trim(),
      category: materialForm.category.trim(),
      sku: materialForm.sku?.trim() || null,
      catalog_source: materialForm.catalog_source.trim() || 'manual',
      unit: materialForm.unit.trim() || 'ud',
      min_stock: Number(materialForm.min_stock) || 0,
      notes: materialForm.notes?.trim() || null,
    }
    const result = editingMaterialId
      ? await updateMaterial(editingMaterialId, payload)
      : await createMaterial(payload)
    setWorking(false)
    if (result.error) {
      setError(result.error)
      return
    }
    setMessage(t(editingMaterialId ? 'materials.messages.materialUpdated' : 'materials.messages.materialCreated'))
    resetMaterialForm()
    await load()
  }

  async function submitVehicle(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setMessage(null)
    if (!vehicleForm.name.trim()) {
      setError(t('materials.messages.vehicleRequired'))
      return
    }
    setWorking(true)
    const payload = {
      ...vehicleForm,
      name: vehicleForm.name.trim(),
      license_plate: vehicleForm.license_plate?.trim() || null,
      notes: vehicleForm.notes?.trim() || null,
    }
    const result = editingVehicleId
      ? await updateVehicle(editingVehicleId, payload)
      : await createVehicle(payload)
    setWorking(false)
    if (result.error) {
      setError(result.error)
      return
    }
    setMessage(t(editingVehicleId ? 'materials.messages.vehicleUpdated' : 'materials.messages.vehicleCreated'))
    resetVehicleForm()
    await load()
  }

  async function handleFile(file: File | null) {
    if (!file) return
    setError(null)
    setMessage(null)
    setWorking(true)
    const { data, error: parseError } = await parseMaterialWorkbook(file)
    setWorking(false)
    if (parseError) {
      setError(parseError)
      setPreviewRows([])
      return
    }
    setPreviewRows(data)
    setMessage(t('materials.messages.rowsDetected', { count: data.length, file: file.name }))
  }

  async function applyImport() {
    if (!user || !importClientId || !importVehicleId || previewRows.length === 0) return
    setWorking(true)
    setError(null)
    const result = await commitMaterialImport({
      clientId: importClientId,
      vehicleId: importVehicleId,
      rows: previewRows,
      createdBy: user.id,
    })
    setWorking(false)
    if (result.error) {
      setError(result.error)
      return
    }
    setMessage(t('materials.messages.imported', { count: result.imported }))
    setPreviewRows([])
    await load()
  }

  if (loading) {
    return <div className="py-10 font-mono text-sm text-fg-3">[LOADING] {t('materials.title')}</div>
  }

  return (
    <div className="page-fade-in space-y-5 pb-8">
      <div className="ph">
        <div>
          <h1>{t('materials.title')}</h1>
          <div className="sub">{t('materials.eyebrow')}</div>
        </div>
        <div className="ph-metrics">
          <div className="kpi compact">
            <div className="k">{t('materials.kpi.materials')}</div>
            <div className="v">{materials.length}</div>
            <div className="d neut">{t('materials.catalog.meta')}</div>
          </div>
          <div className="kpi compact">
            <div className="k">{t('materials.kpi.vehicles')}</div>
            <div className="v">{activeVehicles.length}</div>
            <div className="d neut">{t('materials.vehicles.meta')}</div>
          </div>
          <div className="kpi compact">
            <div className="k">{t('materials.kpi.alerts')}</div>
            <div className={`v ${stockAlerts.length > 0 ? 'text-warn' : ''}`}>{stockAlerts.length}</div>
            <div className={stockAlerts.length > 0 ? 'd down' : 'd neut'}>{t('materials.stock.title')}</div>
          </div>
        </div>
      </div>

      {error && <div className="notice notice-err">{error}</div>}
      {message && <div className="notice notice-ok">{message}</div>}

      <div className="materials-layout">
        <div className="space-y-5">
          <form onSubmit={submitVehicle} className="panel">
            <div className="phead">
              <div className="flex items-center gap-2">
                <CarFront size={18} strokeWidth={1.5} className="text-accent" />
                <h3 className="title">{t('materials.vehicles.title')}</h3>
              </div>
              <span className="m">{t('materials.vehicles.meta')}</span>
            </div>
            <div className="pbody space-y-3">
              <div className="input">
                <label>{t('materials.fields.name')} *</label>
                <input value={vehicleForm.name} onChange={(e) => setVehicleForm((f) => ({ ...f, name: e.target.value }))} placeholder="Rot-Opel Combo" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="input">
                  <label>{t('materials.fields.team')} *</label>
                  <select value={vehicleForm.team} onChange={(e) => setVehicleForm((f) => ({ ...f, team: e.target.value as TeamColor }))}>
                    {TEAMS.map((team) => <option key={team.value} value={team.value}>{team.label}</option>)}
                  </select>
                </div>
                <div className="input">
                  <label>{t('materials.fields.licensePlate')}</label>
                  <input value={vehicleForm.license_plate ?? ''} onChange={(e) => setVehicleForm((f) => ({ ...f, license_plate: e.target.value }))} placeholder={t('materials.placeholders.optional')} />
                </div>
              </div>
              <div className="input">
                <label>{t('materials.fields.notes')}</label>
                <input value={vehicleForm.notes ?? ''} onChange={(e) => setVehicleForm((f) => ({ ...f, notes: e.target.value }))} placeholder={t('materials.placeholders.optional')} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button type="submit" disabled={working} className={primaryBtnCls}>
                  <Save size={15} strokeWidth={1.5} />
                  {editingVehicleId ? t('materials.actions.update') : t('materials.actions.create')}
                </button>
                <button type="button" onClick={resetVehicleForm} className={iconBtnCls}>{t('materials.actions.reset')}</button>
              </div>
            </div>
            <div className="border-t border-line">
              {vehicles.map((vehicle) => (
                <div key={vehicle.id} className="flex items-center justify-between border-b border-line px-4 py-2 last:border-b-0">
                  <button type="button" onClick={() => setSelectedVehicleId(vehicle.id)} className={`text-left text-sm ${selectedVehicleId === vehicle.id ? 'text-accent' : 'text-fg-1'}`}>
                    {vehicle.name}
                    <span className="badge badge-neutral ml-2">{vehicle.team}</span>
                    {!vehicle.active && <span className="badge badge-neutral ml-2">{t('materials.status.inactive')}</span>}
                  </button>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingVehicleId(vehicle.id)
                        setVehicleForm({
                          name: vehicle.name,
                          team: vehicle.team,
                          license_plate: vehicle.license_plate,
                          notes: vehicle.notes,
                          active: vehicle.active,
                        })
                      }}
                      className="btn btn-g btn-sm"
                    >
                      {t('materials.actions.edit')}
                    </button>
                    <button type="button" onClick={() => void deactivateVehicle(vehicle.id).then(load)} className="btn btn-danger btn-sm" aria-label={t('materials.actions.deactivate')}>
                      <Trash2 size={14} strokeWidth={1.5} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </form>

          <form onSubmit={submitMaterial} className="panel">
            <div className="phead">
              <div className="flex items-center gap-2">
                <PackagePlus size={18} strokeWidth={1.5} className="text-accent" />
                <h3 className="title">{t('materials.manual.title')}</h3>
              </div>
              <span className="m">{t('materials.manual.meta')}</span>
            </div>
            <div className="pbody space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="input">
                  <label>{t('materials.fields.catalog')} *</label>
                  <select value={materialForm.catalog_client_id} onChange={(e) => setMaterialForm((f) => ({ ...f, catalog_client_id: e.target.value }))}>
                    <option value="">{t('materials.placeholders.choose')}</option>
                    {clients.map((client) => <option key={client.id} value={client.id}>{client.code}</option>)}
                  </select>
                </div>
                <div className="input">
                  <label>SKU</label>
                  <input value={materialForm.sku ?? ''} onChange={(e) => setMaterialForm((f) => ({ ...f, sku: e.target.value }))} placeholder="GFM000453" />
                </div>
              </div>
              <div className="input">
                <label>{t('materials.fields.name')} *</label>
                <input value={materialForm.name} onChange={(e) => setMaterialForm((f) => ({ ...f, name: e.target.value }))} placeholder="GF-AP HÜP 4-8 WE GFP" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="input">
                  <label>{t('materials.fields.category')} *</label>
                  <input value={materialForm.category} onChange={(e) => setMaterialForm((f) => ({ ...f, category: e.target.value }))} placeholder="Activacion" />
                </div>
                <div className="input">
                  <label>{t('materials.fields.unit')}</label>
                  <input value={materialForm.unit} onChange={(e) => setMaterialForm((f) => ({ ...f, unit: e.target.value }))} />
                </div>
                <div className="input">
                  <label>{t('materials.fields.minStock')}</label>
                  <input
                    type="number"
                    value={materialForm.min_stock === 0 ? '' : materialForm.min_stock}
                    onChange={(e) => setMaterialForm((f) => ({
                      ...f,
                      min_stock: e.target.value === '' ? 0 : Number(e.target.value),
                    }))}
                    placeholder="0"
                  />
                </div>
              </div>
              <div className="input">
                <label>{t('materials.fields.notes')}</label>
                <input value={materialForm.notes ?? ''} onChange={(e) => setMaterialForm((f) => ({ ...f, notes: e.target.value }))} placeholder={t('materials.placeholders.optional')} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button type="submit" disabled={working} className={primaryBtnCls}>
                  <Plus size={15} strokeWidth={1.5} />
                  {editingMaterialId ? t('materials.actions.update') : t('materials.actions.create')}
                </button>
                <button type="button" onClick={resetMaterialForm} className={iconBtnCls}>{t('materials.actions.reset')}</button>
              </div>
            </div>
          </form>
        </div>

        <div className="space-y-5">
          <div className="panel">
            <div className="phead">
              <div>
                <h3 className="title">{t('materials.stock.title')}</h3>
                <p className="m mt-1">{selectedVehicle?.name ?? t('materials.stock.noVehicle')}</p>
              </div>
              <div className="input vehicle-select">
                <label>{t('materials.placeholders.vehicle')}</label>
                <select value={selectedVehicleId} onChange={(e) => setSelectedVehicleId(e.target.value)}>
                  <option value="">{t('materials.placeholders.vehicle')}</option>
                  {activeVehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.name}</option>)}
                </select>
              </div>
            </div>
            <div className="pbody">
              {stockAlerts.length > 0 && (
                <div className="notice notice-warn mb-3">
                  {t('materials.stock.lowStock', { count: stockAlerts.length })}
                </div>
              )}
              <div className="overflow-x-auto">
                <table className="t">
                  <thead>
                    <tr>
                      <th>{t('materials.table.material')}</th>
                      <th>{t('materials.table.category')}</th>
                      <th className="num">{t('materials.table.stock')}</th>
                      <th className="num">{t('materials.table.min')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stockRows.map((row) => {
                      const low = Number(row.quantity) <= Number(row.material.min_stock)
                      return (
                        <tr key={row.id}>
                          <td>
                            {row.material.name}
                            {row.material.sku && <span className="mono ml-2">{row.material.sku}</span>}
                          </td>
                          <td className="mono">{row.material.category}</td>
                          <td className={`num ${low ? 'text-warn' : ''}`}>{fmtQty(row.quantity, row.material.unit)}</td>
                          <td className="num mono">{fmtQty(row.material.min_stock, row.material.unit)}</td>
                        </tr>
                      )
                    })}
                    {stockRows.length === 0 && (
                      <tr><td className="py-6 text-center text-fg-3" colSpan={4}>{t('materials.stock.empty')}</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="phead">
              <div className="flex items-center gap-2">
                <FileSpreadsheet size={18} strokeWidth={1.5} className="text-accent" />
                <h3 className="title">{t('materials.import.title')}</h3>
              </div>
              <span className="m">XLSX</span>
            </div>
            <div className="pbody">
              <div className="import-grid">
                <div className="input">
                  <label>{t('materials.placeholders.catalog')}</label>
                  <select value={importClientId} onChange={(e) => setImportClientId(e.target.value)}>
                    <option value="">{t('materials.placeholders.catalog')}</option>
                    {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
                  </select>
                </div>
                <div className="input">
                  <label>{t('materials.placeholders.vehicle')}</label>
                  <select value={importVehicleId} onChange={(e) => setImportVehicleId(e.target.value)}>
                    <option value="">{t('materials.placeholders.vehicle')}</option>
                    {activeVehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.name}</option>)}
                  </select>
                </div>
                <label className={iconBtnCls}>
                  {t('materials.actions.file')}
                  <input type="file" accept=".xlsx" className="hidden" onChange={(e) => void handleFile(e.target.files?.[0] ?? null)} />
                </label>
              </div>
              {previewRows.length > 0 && (
                <div className="mt-4">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="m">{t('materials.import.previewCount', { count: previewRows.length })}</p>
                    <button type="button" disabled={!importClientId || !importVehicleId || working} onClick={() => void applyImport()} className={primaryBtnCls}>
                      {t('materials.actions.applyImport')}
                    </button>
                  </div>
                  <div className="max-h-72 overflow-auto">
                    <table className="t">
                      <thead>
                        <tr>
                          <th>SKU</th>
                          <th>{t('materials.table.name')}</th>
                          <th>{t('materials.table.category')}</th>
                          <th className="num">{t('materials.table.quantity')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {previewRows.slice(0, 120).map((row) => (
                          <tr key={`${row.source}-${row.rowNumber}-${row.sku ?? row.name}`}>
                            <td className="mono">{row.sku ?? '—'}</td>
                            <td>{row.name}</td>
                            <td className="mono">{row.category}</td>
                            <td className="num">{fmtQty(row.quantity, row.unit)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="panel">
            <div className="phead">
              <h3 className="title">{t('materials.catalog.title')}</h3>
              <span className="m">{t('materials.catalog.meta')}</span>
            </div>
            <div className="catalog-scroll">
              <table className="t">
                <thead>
                  <tr>
                    <th>{t('materials.table.material')}</th>
                    <th>{t('materials.table.catalog')}</th>
                    <th>{t('materials.table.unit')}</th>
                    <th>{t('materials.table.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {materials.map((material) => (
                    <tr key={material.id}>
                      <td>
                        {material.name}
                        <div className="mono">{material.sku ?? t('materials.catalog.noSku')} · {material.category}</div>
                      </td>
                      <td className="mono">{material.clients?.code ?? '—'}</td>
                      <td className="mono">{material.unit}</td>
                      <td>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingMaterialId(material.id)
                              setMaterialForm({
                                name: material.name,
                                category: material.category,
                                sku: material.sku,
                                catalog_client_id: material.catalog_client_id ?? '',
                                catalog_source: material.catalog_source,
                                unit: material.unit,
                                min_stock: material.min_stock,
                                notes: material.notes,
                                is_active: material.is_active,
                              })
                            }}
                            className="btn btn-g btn-sm"
                          >
                            {t('materials.actions.edit')}
                          </button>
                          <button type="button" onClick={() => void deactivateMaterial(material.id).then(load)} className="btn btn-danger btn-sm">
                            {t('materials.actions.off')}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
