import { network } from "hardhat";

const { ethers } = await network.create();

async function main() {
  const [admin, dean, rector, student] = await ethers.getSigners();

  console.log("=== НАЧАЛО ДЕПЛОЯ ===");
  console.log("Admin (Account #0): ", admin.address);
  console.log("Dean  (Account #1): ", dean.address);
  console.log("Rector(Account #2): ", rector.address);
  console.log("Student test:       ", student.address);

  const VeriDiploma = await ethers.getContractFactory("VeriDiploma");
  const diploma = await VeriDiploma.deploy(admin.address, dean.address, rector.address);

  await diploma.waitForDeployment();
  const address = await diploma.getAddress();

  console.log("--------------------------------------------------");
  console.log(" VeriDiploma успешно развернут по адресу:");
  console.log(address);
  console.log("--------------------------------------------------");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});