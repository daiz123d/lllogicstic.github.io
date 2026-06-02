# logicstic.github.io

## Deploy with GitLab, Argo CD, and Rancher/Kubernetes

This repository contains a static web app served by nginx on port 8080.

GitLab CI builds and pushes this image:

```text
172.16.4.12:8888/dai.ta/tesst:latest
```

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

The GitLab Runner and Kubernetes nodes must allow the internal insecure registry `172.16.4.12:8888` if GitLab registry is served over HTTP.
