
type Return = {
  name: string, 
  token: string
}
export function csfrHeader(): Return {
  const csfrHeaderName = "x-csrf-token"
  const csfrToken = document
    .cookie
    .split(';')
    .find(cookie => cookie.startsWith('csrf-token'))
    ?.split('=')[1]
    ?.split('%7C')[0] || ""

  //console.log("csfrToken", csfrToken)

  return {
    name: csfrHeaderName,
    token: csfrToken
  }
}

export function csfrHeaderObject(): Record<string,string> {
  const csfrHeaderName = "x-csrf-token"
  const csfrToken = document
    .cookie
    .split(';')
    .find(cookie => cookie.startsWith('csrf-token'))
    ?.split('=')[1]
    ?.split('%7C')[0] || ""

  return {
    [csfrHeaderName]: csfrToken,
  }
}

