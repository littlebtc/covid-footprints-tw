import { promises } from "fs"
import Airtable from "airtable"
import { FeatureCollection } from "geojson"
import { format } from "prettier"

const base = new Airtable().base(process.env.AIRTABLE_BASE_ID ?? "")
const records = await base("data").select({ view: "Grid view" }).all()
const result: FeatureCollection = {
  type: "FeatureCollection",
  features: records.map((record) => {
    const { latitude, longitude, ...properties } = record.fields
    return {
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [latitude as number, longitude as number],
      },
      properties,
    }
  }),
}
await promises.writeFile("result.geojson", format(JSON.stringify(result)))
