using System;
using System.Data.SqlTypes;
using Microsoft.SqlServer.Server;
using System.Text.RegularExpressions;

namespace CLRMalloy
{
    public static class Regexp
    {
        [SqlFunction(IsDeterministic = true, IsPrecise = true)]
        public static SqlBoolean Match(SqlString input, SqlString pattern)
        {
            if (input.IsNull || pattern.IsNull)
                return SqlBoolean.False;

            var regex = new Regex(pattern.Value);
            return new SqlBoolean(regex.IsMatch(input.Value));
        }
    }
}