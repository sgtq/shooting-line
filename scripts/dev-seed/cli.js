import { createClient } from '@supabase/supabase-js'
import { readSeedConfig } from './guard.js'
import { removeDevData, seedDevData } from './seeder.js'

/**
 * @param {string[]} args
 * @returns {Promise<void>}
 */
async function main(args) {
  const command = args[0]
  if (command !== 'seed' && command !== 'remove') {
    throw new Error('Usage: node scripts/dev-seed/cli.js <seed|remove>')
  }

  const config = readSeedConfig(process.env)
  const client = createClient(config.url, config.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  console.log(`Target project: ${config.projectRef}`)

  if (command === 'seed') {
    const emails = await seedDevData(client, { password: config.password })
    console.log(`Seeded ${emails.length} accounts:\n${emails.join('\n')}`)
  } else {
    const count = await removeDevData(client)
    console.log(`Removed ${count} seed accounts and their data.`)
  }
}

main(process.argv.slice(2)).catch((error) => {
  console.error(error.message)
  process.exit(1)
})
