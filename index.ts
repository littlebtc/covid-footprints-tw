import { ApiKey } from "@esri/arcgis-rest-auth"
import { bulkGeocode } from "@esri/arcgis-rest-geocoding"
import Airtable from "airtable"
import fetch from "node-fetch"
import FormData from "isomorphic-form-data"

declare global {
  namespace NodeJS {
    interface Global {
      fetch: typeof fetch
      FormData: typeof FormData
    }
  }
}

global.fetch = fetch
global.FormData = FormData

const esriApiKey = new ApiKey({ key: process.env.ESRI_API_KEY ?? "" })

console.log("Retriving Airtable...")
const base = new Airtable().base(process.env.AIRTABLE_BASE_ID ?? "")
const records = await base("data").select({ view: "Grid view" }).all()
// We use [0, 0] for geocoding failure
const requestRecords = records.filter(
  (record) =>
    record.get("address") &&
    record.get("latitude") !== 0 &&
    record.get("longitude") !== 0
)

console.log(`${requestRecords.length} geocoding needed`)

// Record ID in string, required for sent
const requestIds = requestRecords.map((record) => record.id)

// Addresses to be sent to bulk API
const addresses = requestRecords.map((record, index) => ({
  OBJECTID: index,
  address: `${record.get("address")}`,
}))

if (addresses.length > 0) {
  console.log("Running geocoding...")
  const geocodingResults = await bulkGeocode({
    addresses,
    authentication: esriApiKey,
  })

  // Resulting points result
  const points = geocodingResults.locations.reduce(
    (prev, location) => {
      const point = location.location
      const resultId = (location.attributes as { ResultID: number }).ResultID
      if (point) {
        prev[resultId] = {
          latitude: point.x,
          longitude: point.y,
        }
      }
      return prev
    },
    // Make unmatched result (0,0)
    requestRecords.map((record) => ({ longitude: 0, latitude: 0 }))
  )
  console.log("Upload results...")
  await base("data").update(
    points.map((point, index) => ({
      id: requestIds[index],
      fields: point,
    }))
  )
}
