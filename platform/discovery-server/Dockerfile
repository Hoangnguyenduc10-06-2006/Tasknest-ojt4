FROM eclipse-temurin:21-jre-alpine
RUN apk add --no-cache curl && addgroup -S tasknest && adduser -S tasknest -G tasknest
WORKDIR /app
COPY platform/discovery-server/target/discovery-server-0.1.0-SNAPSHOT.jar app.jar
USER tasknest
EXPOSE 8761
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=65.0", "-jar", "/app/app.jar"]
