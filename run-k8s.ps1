# ==============================================================================
# Peketi Yaswanth - Portfolio Kubernetes (Minikube) Launch Script
# ==============================================================================

Write-Host ">>> Checking Minikube Cluster Status..." -ForegroundColor Cyan
$status = minikube status --format "{{.Host}}" 2>$null
if ($status -ne "Running") {
    Write-Host ">>> Starting Minikube cluster with Docker driver..." -ForegroundColor Yellow
    minikube start --driver=docker --kubernetes-version=v1.31.0 --preload=false
} else {
    Write-Host ">>> Minikube cluster is already running." -ForegroundColor Green
}

Write-Host "`n>>> Applying Kubernetes manifests..." -ForegroundColor Cyan
kubectl apply -f k8s/01-config-secrets.yaml
kubectl apply -f k8s/02-postgres.yaml
kubectl apply -f k8s/03-backend.yaml
kubectl apply -f k8s/04-frontend.yaml

Write-Host "`n>>> Waiting for Pods to be ready..." -ForegroundColor Yellow
kubectl wait --for=condition=ready pod -l app=postgres --timeout=90s
kubectl wait --for=condition=ready pod -l app=backend --timeout=90s
kubectl wait --for=condition=ready pod -l app=frontend --timeout=90s

Write-Host "`n========================================================" -ForegroundColor Green
Write-Host "  Portfolio successfully deployed to Kubernetes!        " -ForegroundColor Green
Write-Host "========================================================" -ForegroundColor Green
kubectl get pods
Write-Host ""
kubectl get services

Write-Host "`nOpening your portfolio in the browser via Minikube tunnel..." -ForegroundColor Cyan
minikube service frontend
