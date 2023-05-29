FROM denoland/deno:alpine-1.34.0

# Create a volume to put the data in with the correct permissions
RUN mkdir -p /app/data && chown -R deno:deno /app/data

EXPOSE 8000
WORKDIR /app
USER deno

COPY --chown=deno:deno [".", "/app/"]

RUN deno cache server.ts

CMD ["task", "serve", "--fetch"]