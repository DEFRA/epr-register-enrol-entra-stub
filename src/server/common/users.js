// Case Management personas. Role values are the Entra ID app roles
// epr-register-enrol-management-fe maps to its internal roles
// (auth.azureEntraId.regulatorRoleValue / supportUserRoleValue).
export const ROLE_REGULATOR = 'Waste.Regulator.Standard'
export const ROLE_SUPPORT_READONLY = 'Waste.SupportUser.ReadOnly'

const password = 'pass'

export const users = [
  {
    id: 'ee4a8e96-9d61-4bc3-8f8e-82eefe6dfac5',
    username: 'ea.regulator@test.gov.uk',
    name: 'EA Regulator',
    roles: [ROLE_REGULATOR]
  },
  {
    id: 'f1baaa53-c1be-4b2e-b481-f37315771a86',
    username: 'nrw.regulator@test.gov.uk',
    name: 'NRW Regulator',
    roles: [ROLE_REGULATOR]
  },
  {
    id: 'f4bc1ebf-3777-4ee0-9a23-6de9c51b62fe',
    username: 'niea.regulator@test.gov.uk',
    name: 'NIEA Regulator',
    roles: [ROLE_REGULATOR]
  },
  {
    id: '6fb13e04-89bf-4f7b-b08d-33b0975a5d40',
    username: 'sepa.regulator@test.gov.uk',
    name: 'SEPA Regulator',
    roles: [ROLE_REGULATOR]
  },
  {
    id: 'af093087-2bca-4bc9-acaf-61189fbaccae',
    username: 'support.readonly@test.gov.uk',
    name: 'Support User',
    roles: [ROLE_SUPPORT_READONLY]
  },
  {
    // Holds neither app role: management-fe answers with its 403
    // "You do not have access to this service" page.
    id: '67cff4fb-dded-440f-a623-43b32c8f7823',
    username: 'no.role@test.gov.uk',
    name: 'No Role User',
    roles: []
  }
].map((user) => ({ ...user, password }))

export const findUser = (username, pass) =>
  users.find((u) => u.username === username && u.password === pass)
