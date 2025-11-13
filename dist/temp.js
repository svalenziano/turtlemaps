const DURHAM_COORDS = `35.9953,-78.9035,35.998,-78.9001`;

const query = "data=" + encodeURIComponent(`
    [bbox: ${DURHAM_COORDS}][out:json][timeout: 10];
    wr["building"];
    out geom;`)

console.log(query);

async function getMap() {
  const response = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: {
      "Content-Type": "text/plain; charset=UTF-8",
    },
    body: query,
  });
  const json = await response.json();
  console.log(json);
}

getMap();