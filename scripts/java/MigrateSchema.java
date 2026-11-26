import org.flywaydb.core.Flyway;

/** Run only by upgrade-local-schema.py inside a disposable Java container. */
public class MigrateSchema {
    public static void main(String[] args) {
        for (String service : new String[]{"identity", "work", "notification"}) {
            Flyway flyway = Flyway.configure()
                .dataSource("jdbc:mysql://127.0.0.1:3306/tasknest_" + service
                    + "?allowPublicKeyRetrieval=true&useSSL=false&connectionTimeZone=UTC", "root", System.getenv("TASKNEST_MIGRATION_PASSWORD"))
                .locations("filesystem:/runner/migrations/" + service)
                .cleanDisabled(true).baselineOnMigrate(false).outOfOrder(false).load();
            flyway.migrate();
            System.out.println("MIGRATED tasknest_" + service);
        }
    }
}
