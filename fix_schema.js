const https = require("https");
const { getSupabaseConfig } = require("./api/_shared");

const config = getSupabaseConfig();
if (!config) {
  console.log("No Supabase config found");
  process.exit(1);
}

// SQL to add item_status column
const sql = `ALTER TABLE lost_found_records ADD COLUMN IF NOT EXISTS item_status TEXT DEFAULT 'unknown'; UPDATE lost_found_records SET item_status = 'unknown' WHERE item_status IS NULL;`;

const postData = JSON.stringify({ query: sql });

const req = https.request(
  {
    hostname: "lmpntaxpzswjdkjqmxgr.supabase.co",
    path: "/rest/v1/rpc/exec_sql",
    method: "POST",
    headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + config.key,
        apikey: config.key,
        "Content-Length": Buffer.byteLength(postData),
      },
  },
  (res) => {
    let data = "";
    res.on("data", (chunk) => (data += chunk));
    res.on("end", () => {
      console.log("Status:", res.statusCode);
      console.log("Response:", data.slice(0, 500));
    });
  }
);

req.on("error", (e) => console.log("Error:", e.message));
req.write(postData);
req.end();
