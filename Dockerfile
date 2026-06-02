FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY index.html tracking.html style.css /usr/share/nginx/html/
COPY src/ /usr/share/nginx/html/src/
COPY threeJsLib/ /usr/share/nginx/html/threeJsLib/

EXPOSE 8080
