const {install, packageJson, json} = require('mrm-core')
const replace = require('replace-in-file')
const execa = require('execa')

module.exports = async config => {
	const {dbType} = config.defaults({dbType: 'pg'}).values()

	// Update Config Variables
	json('./config/default.json')
		.merge({
			db: {
				host: null,
				user: null,
				password: null,
				port: 20114,
				database: 'local'
			}
		})
		.save()
	json('./config/custom-environment-variables.json')
		.merge({
			db: {
				host: 'DB_HOST',
				user: 'DB_USER',
				password: 'DB_PASSWORD'
			}
		})
		.save()
	json('./config/tap.json')
		.merge({
			db: {}
		})
		.save()

	// Update Scripts for DB Support
	packageJson()
		.setScript('start', 'knex-migrate up && node index.js')
		.save()

	// Install Relevant Packages
	const pkg = json('package.json')
	const packages = [
		'objection',
		'objection-db-errors',
		'objection-soft-delete',
		'knex',
		'knex-migrate'
	]
	const devPackages = []

	switch (dbType) {
		case 'pg':
		case 'postgresql':
			packages.push('pg')
			pkg.merge({plop: {dbType: 'pg'}})
			break
		case 'sqlite':
		case 'lite':
			packages.push('sqlite3')
			pkg.merge({plop: {dbType: 'sqlite'}})
			break
		default:
			console.error('MRM@database: dbType default called')
	}

	pkg.save()

	install(devPackages, {dev: true})
	install(packages, {dev: false})

	// Update Root PlopFile
	await replace({
		files: './plop-new.js',
		from:
			"plop.setGenerator('new model', require('./plop/generators/new/db/model'))",
		to: ''
	})
	replace({
		files: './plop-new.js',
		from: '/* MRMInjection */',
		to:
			"/* MRMInjection */\nplop.setGenerator('new model', require('./plop/generators/new/db/model'))"
	})

	// Apply Prettier to Standardize Formatting
	try {
		await execa('./node_modules/.bin/prettier', ['--write', './plop-new.js'])
	} catch (error) {
		console.log(error)
	}
}

module.exports.description = 'Extension to support Database Functionality'
