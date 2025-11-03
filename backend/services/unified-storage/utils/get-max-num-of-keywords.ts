
export function getMaxNumKeywords(tierLevel: number) {
  switch(tierLevel) {
    case 0:
      return 10
    case 1:
      return 50
    case 9:
      return 1000 // Unlimited for sub_free users
    default:
      return 10
  }
}
