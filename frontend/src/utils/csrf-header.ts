
type Return = {
  name: string, 
  token: string
}
export function csfrHeader(): Return {
  const csrfHeaderName = "x-csrf-token"
  const raw = document.cookie
    .split("; ")
    .find((entry) => entry.startsWith("csrf-token="))
    ?.split("=")[1] ?? "";

  const decoded = decodeURIComponent(raw);

  const token = decoded.split("|")[0];
  console.log("csrf-token", token)


  return {
    name: csrfHeaderName,
    token: token
  }
}

export function csfrHeaderObject(): Record<string,string> {
  const csrfHeaderName = "x-csrf-token"
  const raw = document.cookie
    .split("; ")
    .find((entry) => entry.startsWith("csrf-token="))
    ?.split("=")[1] ?? "";

  const decoded = decodeURIComponent(raw);

  const token = decoded.split("|")[0];
  console.log("csrf-token", token)

  return {
    [csrfHeaderName]: token,
  }
}

