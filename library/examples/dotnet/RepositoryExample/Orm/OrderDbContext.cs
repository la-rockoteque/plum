using Microsoft.EntityFrameworkCore;

namespace RepositoryExample.Orm;

public sealed class OrderRow
{
    public int Id { get; set; }
    public string Status { get; set; } = "";
}

public sealed class OrderDbContext(DbContextOptions<OrderDbContext> options) : DbContext(options)
{
    public DbSet<OrderRow> Orders => Set<OrderRow>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        var order = modelBuilder.Entity<OrderRow>();
        order.ToTable("orders");
        order.HasKey(row => row.Id);
        order.Property(row => row.Id).HasColumnName("id").ValueGeneratedNever();
        order.Property(row => row.Status).HasColumnName("status").IsRequired();
    }
}
