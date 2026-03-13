import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// 管理员密码（生产环境应使用环境变量）
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'xiaogua2024';

// 验证管理员权限
function verifyAdmin(request: NextRequest): boolean {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) return false;
  
  const token = authHeader.replace('Bearer ', '');
  return token === ADMIN_PASSWORD;
}

// 获取激活码列表
export async function GET(request: NextRequest) {
  if (!verifyAdmin(request)) {
    return NextResponse.json(
      { success: false, error: '未授权' },
      { status: 401 }
    );
  }

  try {
    const client = getSupabaseClient();

    const { data, error } = await client
      .from('activation_codes')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('查询激活码失败:', error);
      return NextResponse.json(
        { success: false, error: '查询失败' },
        { status: 500 }
      );
    }

    // 获取每个激活码的使用记录统计
    const codesWithStats = await Promise.all(
      (data || []).map(async (code) => {
        const { count } = await client
          .from('activation_records')
          .select('*', { count: 'exact', head: true })
          .eq('code_id', code.id);

        return {
          ...code,
          totalActivations: count || 0,
        };
      })
    );

    return NextResponse.json({
      success: true,
      data: codesWithStats,
    });

  } catch (error) {
    console.error('获取激活码列表错误:', error);
    return NextResponse.json(
      { success: false, error: '服务器错误' },
      { status: 500 }
    );
  }
}

// 生成激活码
export async function POST(request: NextRequest) {
  if (!verifyAdmin(request)) {
    return NextResponse.json(
      { success: false, error: '未授权' },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const { durationType, maxUses, count = 1 } = body;

    // 验证参数
    if (!['1d', '7d', 'permanent'].includes(durationType)) {
      return NextResponse.json(
        { success: false, error: '有效期类型错误' },
        { status: 400 }
      );
    }

    if (typeof maxUses !== 'number' || maxUses < -1) {
      return NextResponse.json(
        { success: false, error: '使用次数错误' },
        { status: 400 }
      );
    }

    if (count < 1 || count > 100) {
      return NextResponse.json(
        { success: false, error: '生成数量必须在1-100之间' },
        { status: 400 }
      );
    }

    const client = getSupabaseClient();

    // 生成激活码
    const codes: string[] = [];
    const codesToInsert: { code: string; duration_type: string; max_uses: number }[] = [];

    while (codes.length < count) {
      // 生成6位数字激活码
      const code = Math.floor(100000 + Math.random() * 900000).toString();

      // 检查是否已存在
      const { data: existing } = await client
        .from('activation_codes')
        .select('code')
        .eq('code', code)
        .single();

      if (!existing) {
        codes.push(code);
        codesToInsert.push({
          code,
          duration_type: durationType,
          max_uses: maxUses,
        });
      }
    }

    // 批量插入
    const { error: insertError } = await client
      .from('activation_codes')
      .insert(codesToInsert);

    if (insertError) {
      console.error('插入激活码失败:', insertError);
      return NextResponse.json(
        { success: false, error: '生成失败' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `成功生成 ${codes.length} 个激活码`,
      data: codes,
    });

  } catch (error) {
    console.error('生成激活码错误:', error);
    return NextResponse.json(
      { success: false, error: '服务器错误' },
      { status: 500 }
    );
  }
}

// 禁用/启用/编辑激活码
export async function PATCH(request: NextRequest) {
  if (!verifyAdmin(request)) {
    return NextResponse.json(
      { success: false, error: '未授权' },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const { id, isActive, maxUses } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: '缺少激活码ID' },
        { status: 400 }
      );
    }

    const client = getSupabaseClient();

    // 构建更新对象
    const updateData: { is_active?: boolean; max_uses?: number } = {};
    if (typeof isActive === 'boolean') {
      updateData.is_active = isActive;
    }
    if (typeof maxUses === 'number') {
      updateData.max_uses = maxUses;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { success: false, error: '没有要更新的内容' },
        { status: 400 }
      );
    }

    const { error } = await client
      .from('activation_codes')
      .update(updateData)
      .eq('id', id);

    if (error) {
      console.error('更新激活码状态失败:', error);
      return NextResponse.json(
        { success: false, error: '更新失败' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '保存成功',
    });

  } catch (error) {
    console.error('更新激活码状态错误:', error);
    return NextResponse.json(
      { success: false, error: '服务器错误' },
      { status: 500 }
    );
  }
}

// 删除激活码
export async function DELETE(request: NextRequest) {
  if (!verifyAdmin(request)) {
    return NextResponse.json(
      { success: false, error: '未授权' },
      { status: 401 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: '缺少激活码ID' },
        { status: 400 }
      );
    }

    const client = getSupabaseClient();

    // 先删除关联的激活记录
    await client
      .from('activation_records')
      .delete()
      .eq('code_id', parseInt(id));

    // 再删除激活码
    const { error } = await client
      .from('activation_codes')
      .delete()
      .eq('id', parseInt(id));

    if (error) {
      console.error('删除激活码失败:', error);
      return NextResponse.json(
        { success: false, error: '删除失败' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '删除成功',
    });

  } catch (error) {
    console.error('删除激活码错误:', error);
    return NextResponse.json(
      { success: false, error: '服务器错误' },
      { status: 500 }
    );
  }
}
