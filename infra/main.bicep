@description('Azure App Service 이름. 전역적으로 고유해야 합니다.')
param appName string = 'productkeeper-${uniqueString(resourceGroup().id)}'

@description('리소스를 배치할 Azure 지역')
param location string = resourceGroup().location

@description('App Service Basic 요금제')
param skuName string = 'B1'

@description('App Service Linux 런타임')
param linuxFxVersion string = 'NODE|22-lts'

resource appServicePlan 'Microsoft.Web/serverfarms@2023-01-01' = {
  name: '${appName}-plan'
  location: location
  kind: 'linux'
  sku: {
    name: skuName
    tier: 'Basic'
    size: skuName
    family: 'B'
    capacity: 1
  }
  properties: {
    reserved: true
  }
}

resource webApp 'Microsoft.Web/sites@2023-01-01' = {
  name: appName
  location: location
  kind: 'app,linux'
  properties: {
    serverFarmId: appServicePlan.id
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: linuxFxVersion
      appCommandLine: 'node src/index.js'
      alwaysOn: true
      ftpsState: 'FtpsOnly'
      minTlsVersion: '1.2'
      http20Enabled: true
      healthCheckPath: '/api/health'
      appSettings: [
        {
          name: 'PORT'
          value: '8080'
        }
        {
          name: 'WEBSITES_PORT'
          value: '8080'
        }
        {
          name: 'NODE_ENV'
          value: 'production'
        }
        {
          name: 'SCM_DO_BUILD_DURING_DEPLOYMENT'
          value: 'false'
        }
        {
          name: 'WEBSITE_RUN_FROM_PACKAGE'
          value: '1'
        }
        {
          name: 'PRODUCTKEEPER_DATA_DIR'
          value: '/tmp/productkeeper-data'
        }
        {
          name: 'PRODUCTKEEPER_UPLOAD_DIR'
          value: '/tmp/productkeeper-uploads'
        }
      ]
    }
  }
}

output appServiceName string = webApp.name
output appServiceHostName string = webApp.properties.defaultHostName
output appServiceUrl string = 'https://${webApp.properties.defaultHostName}'
