/**
 * Everything the Rückmeldung screen needs to open, in one call — from the
 * network when there is one, from the device when there is not.
 *
 * Six round trips used to live inside the page's mount effect (order, photos,
 * history, legacy detail row, capture plan, capture report, plus the catalogs
 * the work type pulls in). Under the 4G a fiber crew actually works with, they
 * fail together, and the technician was left with an empty screen holding a
 * phone over a trench. Here they succeed together and get cached as one
 * snapshot, or the last good snapshot is handed back instead.
 */

import {
  fetchStateHistory,
  fetchWorkOrder,
  fetchWorkOrderPhotos,
  normalizeReportedServiceItems,
  type ReportedServiceItemDraft,
  type WorkOrderWithRelations,
} from '@/services/workOrderService'
import { applicableServiceItems, fetchServiceItems } from '@/services/serviceItemService'
import { fetchVehicles } from '@/services/materialInventoryService'
import {
  fetchCapturePlanForOrder,
  fetchCaptureReport,
  type CapturePhotoRow,
} from '@/services/capturePlanService'
import { cacheOrderSnapshot, readOrderSnapshot } from '@/services/offlineCache'
import type { CaptureAnswers, CapturePlan } from '@/types/capture-plan'
import type { ServiceItemWithRelations } from '@/types/service-items'
import type { InventoryVehicle } from '@/types/material-inventory'
import type { TeamColor } from '@/types/enums'

export interface RueckmeldungSnapshot {
  order: WorkOrderWithRelations
  plan: CapturePlan | null
  answers: CaptureAnswers
  photos: CapturePhotoRow[]
  reportedDrafts: ReportedServiceItemDraft[]
  catalog: ServiceItemWithRelations[]
  vehicles: InventoryVehicle[]
  returnedNote: string | null
}

export interface RueckmeldungLoadResult {
  data: RueckmeldungSnapshot | null
  error: string | null
  /** True when the network failed and this came out of IndexedDB. */
  fromCache: boolean
  /** When that snapshot was taken, so the screen can say how old it is. */
  cachedAt: string | null
}

/**
 * The catalog rows this order's technician may report — global rows stay
 * visible. Pass-through positions are excluded: they are settled at actual
 * cost from administration, and reporting one would block the internal
 * certification on a missing price (migration 063).
 */
function applicableCatalog(
  items: ServiceItemWithRelations[],
  order: WorkOrderWithRelations,
): ServiceItemWithRelations[] {
  return applicableServiceItems(items, {
    clientId: order.client_id,
    operatorId: order.operator_id,
    excludePassThrough: true,
  })
}

async function loadFromNetwork(
  workOrderId: string,
  fallbackTeam: TeamColor | null,
): Promise<RueckmeldungLoadResult> {
  const [{ data: order, error: orderError }, { data: photoRows }, { data: history }] =
    await Promise.all([
      fetchWorkOrder(workOrderId),
      fetchWorkOrderPhotos(workOrderId),
      fetchStateHistory(workOrderId),
    ])

  if (orderError || !order) {
    return { data: null, error: orderError ?? 'not_found', fromCache: false, cachedAt: null }
  }

  // The plan drives the whole form and the report holds everything the
  // technician has entered so far. Orders captured before the plans existed were
  // moved into a report by migration 055, so there is nothing else to read.
  const [plan, { data: report }] = await Promise.all([
    fetchCapturePlanForOrder(order),
    fetchCaptureReport(workOrderId),
  ])
  const answers: CaptureAnswers = report?.answers ?? {}

  let catalog: ServiceItemWithRelations[] = []
  let reportedDrafts: ReportedServiceItemDraft[] = []
  if (order.work_type === 'alta') {
    const { data: items } = await fetchServiceItems({ includeInactive: false })
    catalog = applicableCatalog(items, order)
    reportedDrafts = normalizeReportedServiceItems(report?.reported_service_items)
  }

  let vehicles: InventoryVehicle[] = []
  const team = (order.assigned_team ?? fallbackTeam ?? null) as TeamColor | null
  if (team) {
    const { data: teamVehicles } = await fetchVehicles({ team, includeInactive: false })
    vehicles = teamVehicles
  }

  const historyEntries = (history ?? []) as Array<{ to_status: string; notes: string | null }>
  const returnEntry = [...historyEntries].reverse().find((entry) => entry.to_status === 'returned')

  const snapshot: RueckmeldungSnapshot = {
    order,
    plan,
    answers,
    photos: (photoRows ?? []) as CapturePhotoRow[],
    reportedDrafts,
    catalog,
    vehicles,
    returnedNote: returnEntry?.notes ?? null,
  }

  // Best effort: a device that cannot cache still works with a network.
  await cacheOrderSnapshot({ workOrderId, ...snapshot })

  return { data: snapshot, error: null, fromCache: false, cachedAt: null }
}

/**
 * Loads the screen. Goes to the network first even when the browser claims to
 * be offline — `navigator.onLine` lies often enough (captive portals, a phone
 * that just woke up) that a wasted request beats a wrongly stale form.
 */
export async function loadRueckmeldung(
  workOrderId: string,
  fallbackTeam: TeamColor | null,
): Promise<RueckmeldungLoadResult> {
  let networkResult: RueckmeldungLoadResult
  try {
    networkResult = await loadFromNetwork(workOrderId, fallbackTeam)
  } catch (error) {
    networkResult = {
      data: null,
      error: error instanceof Error ? error.message : 'network_error',
      fromCache: false,
      cachedAt: null,
    }
  }
  if (networkResult.data) return networkResult

  const cached = await readOrderSnapshot(workOrderId)
  if (!cached) return networkResult

  const { workOrderId: _id, cachedAt, ...snapshot } = cached
  void _id
  return { data: snapshot, error: null, fromCache: true, cachedAt }
}
