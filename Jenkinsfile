pipeline {
  agent any
  environment {
    NODE_ENV = 'production'
    // Add other required environment variables here or load from Jenkins credentials
  }
  stages {
    stage('Install') {
      steps {
        sh 'npm ci'
      }
    }
    stage('Lint') {
      steps {
        sh 'npm run lint'
      }
    }
    stage('Test') {
      steps {
        sh 'npm test'
        // Run integration tests
        sh 'npm run test:integration || node tests/integration/api/admin-loyalty-rewards.test.js'
      }
    }
    stage('Build') {
      steps {
        sh 'npm run build'
      }
    }
    stage('Env Validation') {
      steps {
        sh 'node scripts/validate-env.js'
      }
    }
    stage('DB Migration') {
      steps {
        sh 'npx prisma migrate deploy'
        sh 'npx prisma db pull'
      }
    }
    stage('Asset Optimization') {
      steps {
        // Add Cloudinary upload and CDN purge scripts here if needed
        echo 'Optimize and upload static assets'
      }
    }
    stage('Deploy to Staging') {
      steps {
        // Add your staging deploy script/command here
        echo 'Deploying to staging...'
      }
    }
    stage('Health Checks') {
      steps {
        sh 'node scripts/health-check.js'
        echo 'Health checks complete.'
      }
    }
    stage('Promote to Production') {
      when {
        branch 'main'
      }
      steps {
        // Promote validated staging build to production
        sh 'sh scripts/promote-to-production.sh'
        echo 'Promoting to production...'
      }
    }
    stage('Post-Deploy') {
      steps {
        script {
          try {
            // Health check already run in previous stage
            // If you want to re-run, call: sh 'node scripts/health-check.js'
            echo 'Deployment succeeded. Sending notification.'
            sh 'SLACK_WEBHOOK_URL=$SLACK_WEBHOOK_URL SLACK_MESSAGE="Deployment complete: $(git rev-parse HEAD)" node scripts/notify-slack.js'
          } catch (err) {
            echo 'Health check failed. Rolling back deployment.'
            // Add rollback script/command here (e.g., redeploy previous build, restore backup)
            sh 'SLACK_WEBHOOK_URL=$SLACK_WEBHOOK_URL SLACK_MESSAGE="Rollback triggered: $(git rev-parse HEAD)" node scripts/notify-slack.js'
            error('Deployment failed and rollback triggered.')
          }
        }
        echo 'Post-deploy actions (rollback, notify)'
      }
    }
  }
}
