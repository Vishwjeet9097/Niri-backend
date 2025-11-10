pipeline {
  agent any

  environment {
    AWS_ACCOUNT_ID      = "183295421833"
    AWS_DEFAULT_REGION  = "ap-south-2"

    BACKEND_ECR_URI     = "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_DEFAULT_REGION}.amazonaws.com/niri-backend-dev"
    BACKEND_DOCKERFILE  = "Dockerfile"
    BACKEND_TAG         = "latest"
    BACKEND_SERVICE     = "niri-backend-dev"
    BACKEND_CLUSTER     = "niri-dev"
    BACKEND_TASKDEF     = "niri-backend-dev:4"
  }

  options {
    // keeps console logs tidy; optional
    timestamps()
  }

  stages {
    stage('Checkout') {
      steps {
        // Jenkins will already check out the repo because the job is Pipeline-from-SCM.
        // This 'checkout scm' makes it explicit and refresh-safe.
        checkout scm
        sh 'git rev-parse --abbrev-ref HEAD && git log -1 --pretty=oneline'
      }
    }

    stage('Copy Config') {
      steps {
        sh 'cp /opt/niri-backend-dev/database.config.ts $WORKSPACE/src/config/database.config.ts'
        sh 'cp /opt/niri-backend-dev/data-source.ts $WORKSPACE/src/database/data-source.ts'
      }
    }

    stage('Copy .env to Build Directory') {
      steps {
        sh 'cp /opt/niri-backend-dev/.env ./'
      }
    }

    stage('Login to AWS ECR') {
      steps {
        sh """
          aws ecr get-login-password --region ${AWS_DEFAULT_REGION} \
          | docker login --username AWS --password-stdin ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_DEFAULT_REGION}.amazonaws.com
        """
      }
    }

    stage('Build Backend Docker Image') {
      steps {
        sh "docker build -f ${BACKEND_DOCKERFILE} -t ${BACKEND_ECR_URI}:${BACKEND_TAG} ."
      }
    }

    stage('Push Backend Docker Image') {
      steps {
        sh "docker push ${BACKEND_ECR_URI}:${BACKEND_TAG}"
      }
    }

    stage('Deploy Backend to ECS') {
      steps {
        sh """
          aws ecs update-service \
            --cluster ${BACKEND_CLUSTER} \
            --service ${BACKEND_SERVICE} \
            --task-definition ${BACKEND_TASKDEF} \
            --force-new-deployment \
            --region ${AWS_DEFAULT_REGION}
        """
      }
    }

    stage('Clean') {
      steps {
        sh "docker rmi ${BACKEND_ECR_URI}:${BACKEND_TAG} || true"
        cleanWs()
      }
    }
  }

  post {
    always {
      echo "Build finished with status: ${currentBuild.currentResult}"
    }
  }
}
