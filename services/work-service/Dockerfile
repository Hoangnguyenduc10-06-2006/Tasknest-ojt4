FROM eclipse-temurin:21-jre-alpine
RUN apk add --no-cache curl && addgroup -S tasknest && adduser -S tasknest -G tasknest
RUN mkdir -p /var/lib/tasknest/files /app/local/work-files && chown -R tasknest:tasknest /var/lib/tasknest /app/local
WORKDIR /app
COPY services/work-service/target/work-service-0.1.0-SNAPSHOT.jar app.jar
USER tasknest
EXPOSE 8082
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=65.0", "-jar", "/app/app.jar"]
