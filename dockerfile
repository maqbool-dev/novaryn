# Use the lightweight official Nginx image as our base — small footprint, fast pulls
FROM nginx:alpine

# Clear out Nginx's default placeholder page so it doesn't conflict with your site
RUN rm -rf /usr/share/nginx/html/*

# Copy your static site files into Nginx's default web root
COPY . /usr/share/nginx/html

# Document that the container listens on port 80 (informational — doesn't actually publish it)
EXPOSE 80

# No CMD needed — the base nginx:alpine image already starts Nginx in the foreground
