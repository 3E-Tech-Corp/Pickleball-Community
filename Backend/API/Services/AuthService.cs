using System.Data;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.SqlServer;
using Microsoft.IdentityModel.Tokens;
using Pickleball.Community.Database;
using Pickleball.Community.Models.DTOs;
using Pickleball.Community.Models.Entities;

using Microsoft.AspNetCore.Mvc;

// TODO: Password hashing and authentication is handled by Funtime-Shared auth service.
// Local AuthService uses SHA256 for legacy/fallback support only.

namespace Pickleball.Community.Services;

public class AuthService : IAuthService
{
    private readonly ApplicationDbContext _context;
    private readonly IConfiguration _configuration;

    public AuthService(ApplicationDbContext context, IConfiguration configuration)
    {
        _context = context;
        _configuration = configuration;
    }



    public string HashPassword(string password)
    {
        // Simple hash for demo - use ASP.NET Core Identity in production
        using var sha256 = SHA256.Create();
        var hashedBytes = sha256.ComputeHash(Encoding.UTF8.GetBytes(password));
        return Convert.ToBase64String(hashedBytes);
    }

    public bool VerifyPassword(string password, string hash)
    {
        var hashOfInput = HashPassword(password);
        return hashOfInput == hash;
    }


    public async Task<User?> AuthenticateAsync(string email, string password)
    {
        var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == email);
        if (user == null)
        {
            throw (new Exception("User account not found"));
        }

        if (user.PasswordHash == null || string.IsNullOrEmpty(user.PasswordHash))
        {
            // No password set - authentication fails. User must set password via shared auth.
            return null;
        }
        else if (!VerifyPassword(password, user.PasswordHash))
        {
            throw (new Exception("Invalid email or password"));
        }

        if (!user.IsActive)
        {
            throw (new Exception("Account is inactive"));
        }


        return user;
    }

    public async Task<User?> FastAuthenticateAsync(string token)
    {
        var parameters = new[]
   {
        new SqlParameter("@token", token),
    };
        var users = await _context.Users
            .FromSqlRaw("EXEC dbo.FastLogin @token", parameters)
            .AsNoTracking()  // Since we're just authenticating, not modifying
            .ToListAsync();

        // Return the first user (should only be one if token is valid)
        return users.FirstOrDefault();

    }
    public async Task<User> RegisterAsync(RegisterRequest request)
    {
        if (await _context.Users.AnyAsync(u => u.Email == request.Email))
        {
            throw new ArgumentException("User already exists");
        }

        var passwordHash = HashPassword(request.Password );
        var user = new User
        {
            Email = request.Email,
            PasswordHash = passwordHash,
            FirstName = request.FirstName,
            LastName = request.LastName,
            Role = request.Role,
            CreatedAt = DateTime.Now,
            UpdatedAt = DateTime.Now
        };

        _context.Users.Add(user);
        await _context.SaveChangesAsync();

        return user;
    }

    public string GenerateJwtToken(User user)
    {
        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim(ClaimTypes.Email, user.Email),
            new Claim(ClaimTypes.GivenName, user.FirstName),
            new Claim(ClaimTypes.Surname, user.LastName),
            new Claim(ClaimTypes.Name, Utility.FormatName(user.LastName, user.FirstName)),
            new Claim(ClaimTypes.Role, user.Role)  // Use ClaimTypes.Role for proper [Authorize(Roles=...)]
        };

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_configuration["Jwt:Key"]));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(
            issuer: _configuration["Jwt:Issuer"],
            audience: _configuration["Jwt:Audience"],
            claims: claims,
            expires: DateTime.Now.AddDays(7),
            signingCredentials: creds);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    public async Task<User?> UpdateRoleAsync(int userId, string role)
    {
        var user = await _context.Users.FindAsync(userId);
        if (user == null)
        {
            return null;
        }

        // Validate role
        var validRoles = new[] { "Player", "Manager", "Admin" };
        if (!validRoles.Contains(role))
        {
            throw new ArgumentException($"Invalid role. Must be one of: {string.Join(", ", validRoles)}");
        }

        user.Role = role;
        user.UpdatedAt = DateTime.Now;
        await _context.SaveChangesAsync();

        return user;
    }
}