export const CONTRACT_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
export const BACKEND_URL = "http://localhost:8000";

export const CONTRACT_ABI = [
  // Функции
  "function proposeDiploma(address student, string name, string major, uint16 year) returns (uint256)",
  "function approveDiploma(uint256 tokenId)",
  "function revokeDiploma(uint256 tokenId, string reason)",
  "function diplomas(uint256) view returns (uint256 tokenId, string studentName, string major, uint16 graduationYear, uint8 status, string revocationReason, address studentAddress)",
  "function tokenURI(uint256 tokenId) view returns (string)",
  "function DEAN_ROLE() view returns (bytes32)",
  "function RECTOR_ROLE() view returns (bytes32)",
  "function hasRole(bytes32 role, address account) view returns (bool)",

  // Кастомные ошибки OpenZeppelin и смарт-контракта
  "error AccessControlUnauthorizedAccount(address account, bytes32 neededRole)",
  "error DiplomaIsSoulbound()",
  "error DiplomaNotFound()",
  "error InvalidDiplomaStatus()",
  "error EmptyReason()"
];