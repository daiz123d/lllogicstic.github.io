# logicstic.github.io

## Deploy with GitLab, Argo CD, and Rancher/Kubernetes

This repository contains a static web app served by nginx on port 8080.

## GitHub Pages

Public deployment:

```text
https://daiz123d.github.io/lllogicstic.github.io/
```

GitLab CI builds and pushes this image:

```text
harbor.tinasoft.io/daita/tesst:latest
```

Required masked GitLab CI/CD variables:

```text
HARBOR_USER
HARBOR_PASSWORD
```

The pipeline uses these Harbor image settings in `.gitlab-ci.yml`:

```text
HARBOR_REGISTRY=harbor.tinasoft.io
HARBOR_PROJECT=daita
HARBOR_REPOSITORY=tesst
```

If the Harbor project or repository name is different, update
`HARBOR_PROJECT`, `HARBOR_REPOSITORY`, and the image in
`k8s/deployment.yaml`.

Argo CD should use:

```text
Repository URL: http://172.16.4.12:8888/dai.ta/tesst.git
Revision: main
Path: k8s
Cluster URL: https://kubernetes.default.svc
Namespace: argocd
```

The Kubernetes service is exposed with NodePort 30080:

```text
http://<k8s-node-ip>:30080
```

GitLab CI uses Kaniko, so the runner does not need a local Docker daemon.
The cluster only needs network access to `harbor.tinasoft.io` and the pull
secret below if the Harbor project is private.

For private Harbor projects, create the pull secret once in the deployment
namespace:

```bash
kubectl -n argocd create secret docker-registry harbor-pull-secret \
  --docker-server=harbor.tinasoft.io \
  --docker-username=<harbor-user-or-robot> \
  --docker-password=<harbor-password-or-token>
```
