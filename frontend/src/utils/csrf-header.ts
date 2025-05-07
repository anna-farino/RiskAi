
type Return = {
  name: string, 
  token: string
}
export function csfrHeader(): Return {
  const csfrHeaderName = "x-csrf-token"
  const csfrToken = document.cookie
    .split('; ')
    .map(str => str.trim())
    .find(str => str.startsWith('csrf-token='))      
    ?.split('=')[1]                                 
    ?? ""; 


  return {
    name: csfrHeaderName,
    token: csfrToken
  }
}

export function csfrHeaderObject(): Record<string,string> {
  const csrfHeaderName = "x-csrf-token"
  const csrfToken = document.cookie
    .split('; ')
    .map(str => str.trim())
    .find(str => str.startsWith('csrf-token='))      
    ?.split('=')[1]                                  
    ?? ""; 

  return {
    [csrfHeaderName]: csrfToken,
  }
}

