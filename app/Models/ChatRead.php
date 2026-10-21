<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ChatRead extends Model
{
    protected $fillable = ['user_id', 'center_id', 'channel', 'last_read_id'];
}
